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

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws }
});

const fail = (step, error) => {
  throw new Error(`${step} failed: ${error?.message || error}`);
};

const signIn = async (email, password, label) => {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) fail(`${label} sign in`, error);
  return client;
};

const run = async () => {
  console.log('--- Two-Stage Course Workflow Test Start ---');

  const stamp = Date.now();
  const artistEmail = `workflow.artist.${stamp}@test.local`;
  const artistPassword = 'WorkflowArtist12345!';

  // Create a fresh approved artist account.
  const { data: authUser, error: authCreateError } = await service.auth.admin.createUser({
    email: artistEmail,
    password: artistPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Workflow Artist', role: 'kuenstler' }
  });
  if (authCreateError) fail('create artist auth user', authCreateError);

  const artistId = authUser.user?.id;
  if (!artistId) {
    throw new Error('No artist auth user id returned');
  }

  const admin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');

  // Ensure the domain user row exists (trigger should create it). Avoid role change via service role.
  const { data: createdUserRow, error: fetchCreatedUserError } = await service
    .from('users')
    .select('id,email,role')
    .eq('id', artistId)
    .maybeSingle();
  if (fetchCreatedUserError) fail('fetch created users row', fetchCreatedUserError);

  if (!createdUserRow?.id) {
    const { error: insertUserError } = await service
      .from('users')
      .insert({ id: artistId, email: artistEmail, full_name: 'Workflow Artist' });
    if (insertUserError) fail('insert users row', insertUserError);
  }

  const { data: existingProfile, error: existingProfileError } = await service
    .from('artist_profile')
    .select('id')
    .eq('user_email', artistEmail)
    .maybeSingle();
  if (existingProfileError) fail('fetch existing artist profile', existingProfileError);

  if (existingProfile?.id) {
    const { error: updateProfileError } = await service
      .from('artist_profile')
      .update({ display_name: 'Workflow Artist', is_approved: true })
      .eq('id', existingProfile.id);
    if (updateProfileError) fail('update artist profile', updateProfileError);
  } else {
    const { error: insertProfileError } = await service
      .from('artist_profile')
      .insert({ user_email: artistEmail, display_name: 'Workflow Artist', is_approved: true });
    if (insertProfileError) fail('insert artist profile', insertProfileError);
  }

  // Promote role through authenticated admin path to satisfy role-change guard.
  const { error: promoteError } = await admin
    .from('users')
    .update({ role: 'kuenstler' })
    .eq('id', artistId);
  if (promoteError) fail('admin promote artist role', promoteError);

  const artist = await signIn(artistEmail, artistPassword, 'Artist');

  // 1) Artist creates draft.
  const { data: draft, error: createDraftError } = await artist
    .from('course')
    .insert({
      title: `Workflow Draft ${stamp}`,
      description: 'Two-stage workflow test',
      price: 55,
      status: 'entwurf',
      artist_email: artistEmail,
      artist_name: 'Workflow Artist',
      category: 'malerei',
      level: 'anfaenger'
    })
    .select('*')
    .single();
  if (createDraftError) fail('artist create draft', createDraftError);
  console.log('Draft created:', draft.id);

  // 2) Artist must not publish directly.
  const { error: publishByArtistError } = await artist
    .from('course')
    .update({ status: 'veroeffentlicht' })
    .eq('id', draft.id)
    .select('*')
    .single();
  if (!publishByArtistError) {
    throw new Error('Artist could publish directly, workflow guard is not active');
  }
  console.log('Artist direct publish blocked (expected)');

  // 3) Artist submits for approval.
  const { data: submitted, error: submitError } = await artist
    .from('course')
    .update({ status: 'ausstehend_freigabe' })
    .eq('id', draft.id)
    .select('*')
    .single();
  if (submitError) fail('artist submit for approval', submitError);
  if (submitted.status !== 'ausstehend_freigabe') {
    throw new Error(`Expected ausstehend_freigabe, got ${submitted.status}`);
  }
  console.log('Submitted for approval');

  // 4) Admin internal approval.
  const { data: internallyApproved, error: internalApproveError } = await admin
    .from('course')
    .update({ status: 'freigegeben_intern' })
    .eq('id', draft.id)
    .select('*')
    .single();
  if (internalApproveError) fail('admin internal approval', internalApproveError);
  if (internallyApproved.status !== 'freigegeben_intern') {
    throw new Error(`Expected freigegeben_intern, got ${internallyApproved.status}`);
  }
  console.log('Internally approved');

  // 5) Admin publish from internal approval.
  const { data: published, error: publishError } = await admin
    .from('course')
    .update({ status: 'veroeffentlicht' })
    .eq('id', draft.id)
    .select('*')
    .single();
  if (publishError) fail('admin publish', publishError);
  if (published.status !== 'veroeffentlicht') {
    throw new Error(`Expected veroeffentlicht, got ${published.status}`);
  }
  console.log('Published from internal approval');

  // 6) Rejection requires note.
  const { data: rejectDraft, error: rejectDraftCreateError } = await artist
    .from('course')
    .insert({
      title: `Workflow Reject ${stamp}`,
      description: 'Rejection path test',
      price: 45,
      status: 'ausstehend_freigabe',
      artist_email: artistEmail,
      artist_name: 'Workflow Artist',
      category: 'malerei',
      level: 'anfaenger'
    })
    .select('*')
    .single();
  if (rejectDraftCreateError) fail('create second course for rejection', rejectDraftCreateError);

  const { error: rejectWithoutNoteError } = await admin
    .from('course')
    .update({ status: 'abgelehnt' })
    .eq('id', rejectDraft.id)
    .select('*')
    .single();
  if (!rejectWithoutNoteError) {
    throw new Error('Reject without admin_notes succeeded, expected to fail');
  }

  const { data: rejected, error: rejectWithNoteError } = await admin
    .from('course')
    .update({ status: 'abgelehnt', admin_notes: 'Bitte Kursbeschreibung konkretisieren.' })
    .eq('id', rejectDraft.id)
    .select('*')
    .single();
  if (rejectWithNoteError) fail('reject with note', rejectWithNoteError);
  if (rejected.status !== 'abgelehnt') {
    throw new Error(`Expected abgelehnt, got ${rejected.status}`);
  }
  console.log('Rejection with note works');

  console.log('--- Two-Stage Course Workflow PASS ---');
  console.log(JSON.stringify({
    artistEmail,
    publishedCourseId: draft.id,
    rejectedCourseId: rejectDraft.id
  }, null, 2));
};

run().catch((error) => {
  console.error('--- Two-Stage Course Workflow FAIL ---');
  console.error(error.message || error);
  process.exit(1);
});
