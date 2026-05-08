import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

export const createAdminClient = () =>
  createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

export const createUserClient = (authorization: string | null) => {
  if (!anonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {}
    }
  });
};

export const getUserFromRequest = async (authorization: string | null) => {
  const userClient = createUserClient(authorization);
  const {
    data: { user },
    error
  } = await userClient.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
};
