import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONFIRM_RESET = process.env.CONFIRM_RESET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (CONFIRM_RESET !== 'YES_DELETE_ALL_DATA') {
  console.error('Refusing to run. Set CONFIRM_RESET=YES_DELETE_ALL_DATA');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws }
});

const usersToKeep = [
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

const ensureAuthUser = async ({ email, password, full_name, role }) => {
  const existing = await getExistingUserByEmail(email);
  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role
      }
    });

    if (updateError) throw updateError;
    return { id: existing.id, email };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role }
  });

  if (error) throw error;
  return { id: data.user.id, email };
};

const clearTable = async (tableName) => {
  const { error } = await supabase.from(tableName).delete().not('id', 'is', null);
  if (error) {
    throw new Error(`Failed clearing ${tableName}: ${error.message}`);
  }
  console.log(`cleared: ${tableName}`);
};

const ensureDomainRows = async ({ authUser, role, full_name, email }) => {
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
    throw new Error(`Failed upserting users row for ${email}: ${upsertUserError.message}`);
  }

  if (role === 'kuenstler') {
    const { error: insertProfileError } = await supabase
      .from('artist_profile')
      .insert({
        user_email: email,
        display_name: full_name,
        is_approved: true
      });

    if (insertProfileError) {
      throw new Error(`Failed creating artist profile for ${email}: ${insertProfileError.message}`);
    }
  }
};

(async () => {
  try {
    console.log('Preparing kept users...');
    const keptAuthUsers = [];

    for (const def of usersToKeep) {
      const authUser = await ensureAuthUser(def);
      keptAuthUsers.push({ ...def, id: authUser.id });
      console.log(`keep: ${def.role} -> ${def.email}`);
    }

    const keepEmails = new Set(usersToKeep.map((u) => u.email.toLowerCase()));
    const allUsers = await listAllUsers();
    const usersToDelete = allUsers.filter((u) => !keepEmails.has((u.email || '').toLowerCase()));

    console.log(`Deleting ${usersToDelete.length} auth users...`);
    for (const user of usersToDelete) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        throw new Error(`Failed deleting auth user ${user.email || user.id}: ${error.message}`);
      }
    }

    // Clear child tables before parent tables to avoid FK violations.
    const clearOrder = [
      'enrollment',
      'invoice',
      'booking',
      'lesson',
      'course',
      'calendar_slot',
      'payout_request',
      'room',
      'artist_profile',
      'platform_settings',
      'users'
    ];

    console.log('Clearing domain tables...');
    for (const table of clearOrder) {
      await clearTable(table);
    }

    console.log('Recreating domain rows for kept users...');
    for (const keptUser of keptAuthUsers) {
      await ensureDomainRows({
        authUser: { id: keptUser.id },
        role: keptUser.role,
        full_name: keptUser.full_name,
        email: keptUser.email
      });
    }

    console.log('Done: backend cleared, only three test users kept.');
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
})();
