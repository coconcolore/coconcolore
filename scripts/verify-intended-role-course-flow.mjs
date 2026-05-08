import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = process.env.FLOW_ADMIN_EMAIL || 'admin@test.local';
const ADMIN_PASSWORD = process.env.FLOW_ADMIN_PASSWORD || 'Admin12345!';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const createAnonClient = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  });

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws }
});

const fail = (step, error) => {
  throw new Error(`${step} failed: ${error?.message || error}`);
};

const signIn = async (email, password, label) => {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) fail(`${label} sign-in`, error);
  return { client, session: data.session, user: data.user };
};

const run = async () => {
  const stamp = Date.now();
  const flowEmail = `flow.user.${stamp}@test.local`;
  const flowPassword = 'FlowUser12345!';

  console.log('--- Verify Intended Role + Course Flow Start ---');

  // 1) Create user with role=user
  const { data: created, error: createAuthError } = await serviceClient.auth.admin.createUser({
    email: flowEmail,
    password: flowPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'Flow User',
      role: 'user'
    }
  });
  if (createAuthError) fail('create flow auth user', createAuthError);

  const flowAuthUser = created.user;
  if (!flowAuthUser?.id) {
    throw new Error('No auth user id returned for flow user');
  }

  const { error: upsertUserError } = await serviceClient.from('users').upsert(
    {
      id: flowAuthUser.id,
      email: flowEmail,
      full_name: 'Flow User',
      role: 'user'
    },
    { onConflict: 'id' }
  );
  if (upsertUserError) fail('upsert flow user row', upsertUserError);

  console.log(`Flow user created as user: ${flowEmail}`);

  // 2) user cannot create course
  const userAuth1 = await signIn(flowEmail, flowPassword, 'Flow user');

  const { data: deniedCourse, error: deniedCreateError } = await userAuth1.client
    .from('course')
    .insert({
      title: `Denied test ${stamp}`,
      description: 'Should be denied for role user',
      price: 49,
      status: 'entwurf',
      artist_email: flowEmail,
      artist_name: 'Flow User',
      category: 'malerei',
      level: 'anfaenger'
    })
    .select('*')
    .maybeSingle();

  if (!deniedCreateError) {
    throw new Error(`Expected course create to be denied for role user, but succeeded with id=${deniedCourse?.id}`);
  }

  console.log('Role user is correctly blocked from course creation');

  // 3) admin approves artist + sets role=kuenstler
  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');

  const { data: existingProfile, error: existingProfileError } = await admin.client
    .from('artist_profile')
    .select('id')
    .eq('user_email', flowEmail)
    .maybeSingle();
  if (existingProfileError) fail('fetch artist profile', existingProfileError);

  if (existingProfile?.id) {
    const { error } = await admin.client
      .from('artist_profile')
      .update({ display_name: 'Flow User', is_approved: true })
      .eq('id', existingProfile.id);
    if (error) fail('update artist profile approved', error);
  } else {
    const { error } = await admin.client
      .from('artist_profile')
      .insert({ user_email: flowEmail, display_name: 'Flow User', is_approved: true });
    if (error) fail('insert artist profile approved', error);
  }

  const { error: promoteError } = await admin.client
    .from('users')
    .update({ role: 'kuenstler' })
    .eq('id', flowAuthUser.id);
  if (promoteError) fail('promote role to kuenstler', promoteError);

  console.log('Admin approved artist and promoted role to kuenstler');

  // 4) now user can create draft
  const userAuth2 = await signIn(flowEmail, flowPassword, 'Flow user re-login');

  const { data: draftCourse, error: createDraftError } = await userAuth2.client
    .from('course')
    .insert({
      title: `Flow Draft ${stamp}`,
      description: 'Draft course by approved kuenstler',
      price: 79,
      status: 'entwurf',
      artist_email: flowEmail,
      artist_name: 'Flow User',
      category: 'malerei',
      level: 'anfaenger'
    })
    .select('*')
    .single();
  if (createDraftError) fail('create draft course', createDraftError);

  if (draftCourse.status !== 'entwurf') {
    throw new Error(`Expected draft status, got ${draftCourse.status}`);
  }

  console.log(`Kuenstler draft created: ${draftCourse.id}`);

  // 5) kuenstler submits for approval
  const { data: submittedCourse, error: submitError } = await userAuth2.client
    .from('course')
    .update({ status: 'ausstehend_freigabe' })
    .eq('id', draftCourse.id)
    .select('*')
    .single();
  if (submitError) fail('submit for approval', submitError);

  if (submittedCourse.status !== 'ausstehend_freigabe') {
    throw new Error(`Expected ausstehend_freigabe, got ${submittedCourse.status}`);
  }

  console.log('Kuenstler submitted course for approval');

  // 6) admin publishes
  const { data: publishedCourse, error: publishError } = await admin.client
    .from('course')
    .update({ status: 'veroeffentlicht' })
    .eq('id', draftCourse.id)
    .select('*')
    .single();
  if (publishError) fail('admin publish course', publishError);

  if (publishedCourse.status !== 'veroeffentlicht') {
    throw new Error(`Expected veroeffentlicht, got ${publishedCourse.status}`);
  }

  console.log('Admin published course');
  console.log('--- Verify Intended Role + Course Flow PASS ---');
  console.log(JSON.stringify({
    flowUserId: flowAuthUser.id,
    flowUserEmail: flowEmail,
    courseId: draftCourse.id
  }, null, 2));
};

run().catch((error) => {
  console.error('--- Verify Intended Role + Course Flow FAIL ---');
  console.error(error.message || error);
  process.exit(1);
});
