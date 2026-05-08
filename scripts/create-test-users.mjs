import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws }
});

const usersToCreate = [
  {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.local',
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin12345!',
    role: 'admin',
    full_name: 'Test Admin'
  },
  {
    email: process.env.TEST_ARTIST_EMAIL || 'kuenstler@test.local',
    password: process.env.TEST_ARTIST_PASSWORD || 'Artist12345!',
    role: 'kuenstler',
    full_name: 'Test Kuenstler'
  },
  {
    email: process.env.TEST_LOCATION_EMAIL || 'location@test.local',
    password: process.env.TEST_LOCATION_PASSWORD || 'Location12345!',
    role: 'location_manager',
    full_name: 'Test Location Manager'
  }
];

const listAllUsers = async () => {
  const all = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    all.push(...(data.users || []));
    if (!data.users || data.users.length < perPage) break;
    page += 1;
  }

  return all;
};

const getExistingUserByEmail = async (email) => {
  const users = await listAllUsers();
  return users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
};

const ensureAuthUser = async ({ email, password, full_name }) => {
  const existing = await getExistingUserByEmail(email);
  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: existing.user_metadata?.role || undefined
      }
    });

    if (updateError) throw updateError;
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name }
  });

  if (error) throw error;
  return data.user;
};

const isMissingTableError = (error, tableName) => {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes(`could not find the table 'public.${tableName}'`) || msg.includes(`relation \"public.${tableName}\" does not exist`);
};

const ensureDomainRows = async ({ authUser, role, full_name, email }) => {
  const { error: authMetaError } = await supabase.auth.admin.updateUserById(authUser.id, {
    user_metadata: {
      full_name,
      role
    }
  });

  if (authMetaError) throw authMetaError;

  const { error: upsertUserError } = await supabase
    .from('users')
    .upsert(
      {
        id: authUser.id,
        email,
        role,
        full_name
      },
      { onConflict: 'id' }
    );

  if (upsertUserError) {
    if (isMissingTableError(upsertUserError, 'users')) {
      console.warn('warn: table public.users fehlt noch, rolle nur in auth user_metadata gesetzt.');
      return;
    }
    throw upsertUserError;
  }

  if (role === 'kuenstler') {
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('artist_profile')
      .select('id')
      .eq('user_email', email)
      .maybeSingle();

    if (existingProfileError) {
      if (isMissingTableError(existingProfileError, 'artist_profile')) {
        console.warn('warn: table public.artist_profile fehlt noch, kuenstler-profil wurde nicht angelegt.');
        return;
      }
      throw existingProfileError;
    }

    if (existingProfile?.id) {
      const { error: updateProfileError } = await supabase
        .from('artist_profile')
        .update({
          display_name: full_name,
          is_approved: true
        })
        .eq('id', existingProfile.id);

      if (updateProfileError) throw updateProfileError;
    } else {
      const { error: insertProfileError } = await supabase
        .from('artist_profile')
        .insert({
          user_email: email,
          display_name: full_name,
          is_approved: true
        });

      if (insertProfileError) throw insertProfileError;
    }
  }
};

(async () => {
  try {
    for (const userDef of usersToCreate) {
      const authUser = await ensureAuthUser(userDef);
      await ensureDomainRows({
        authUser,
        role: userDef.role,
        full_name: userDef.full_name,
        email: userDef.email
      });

      console.log(`ok: ${userDef.role} -> ${userDef.email}`);
    }

    console.log('Test users created/updated successfully.');
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
})();
