import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars missing: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const ENTITY_TABLE_MAP = {
  User: 'users',
  ArtistProfile: 'artist_profile',
  Booking: 'booking',
  CalendarSlot: 'calendar_slot',
  Course: 'course',
  Enrollment: 'enrollment',
  Invoice: 'invoice',
  Lesson: 'lesson',
  PayoutRequest: 'payout_request',
  PlatformSettings: 'platform_settings',
  Room: 'room'
};

const ensureSupabase = () => {
  if (!supabase) {
    const error = new Error('Supabase client not configured');
    error.status = 500;
    throw error;
  }
};

const parseSort = (sortBy) => {
  if (!sortBy) {
    return null;
  }

  const descending = sortBy.startsWith('-');
  const column = descending ? sortBy.slice(1) : sortBy;

  return { column, ascending: !descending };
};

const applyCriteria = (query, criteria = {}) => {
  return Object.entries(criteria).reduce((acc, [key, value]) => {
    if (value === undefined) {
      return acc;
    }

    if (value === null) {
      return acc.is(key, null);
    }

    if (Array.isArray(value)) {
      return acc.in(key, value);
    }

    return acc.eq(key, value);
  }, query);
};

const selectMany = async ({ tableName, criteria = {}, sortBy, limit }) => {
  ensureSupabase();

  let query = supabase.from(tableName).select('*');
  query = applyCriteria(query, criteria);

  const sort = parseSort(sortBy);
  if (sort) {
    query = query.order(sort.column, { ascending: sort.ascending });
  }

  if (typeof limit === 'number') {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data || [];
};

const resolveTableName = (entityName) => ENTITY_TABLE_MAP[entityName] || entityName.toLowerCase();

const createEntityApi = (entityName) => {
  const tableName = resolveTableName(entityName);

  return {
    list: (sortBy, limit) => selectMany({ tableName, sortBy, limit }),
    filter: (criteria = {}, sortBy, limit) => selectMany({ tableName, criteria, sortBy, limit }),
    bulkCreate: async (payloads = []) => {
      ensureSupabase();

      if (!Array.isArray(payloads) || payloads.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from(tableName)
        .insert(payloads)
        .select('*');

      if (error) {
        throw error;
      }

      return data || [];
    },
    create: async (payload) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    update: async (id, payload) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    delete: async (id) => {
      ensureSupabase();
      const { error } = await supabase.from(tableName).delete().eq('id', id);

      if (error) {
        throw error;
      }

      return { id };
    }
  };
};

const uploadFile = async ({ file }) => {
  ensureSupabase();

  if (!file) {
    throw new Error('No file provided');
  }

  const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'public';
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const filePath = `uploads/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return { file_url: data.publicUrl };
};

const auth = {
  me: async () => {
    ensureSupabase();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    const authUser = data?.user;
    if (!authUser) {
      const unauthorized = new Error('Authentication required');
      unauthorized.status = 401;
      throw unauthorized;
    }

    const baseUser = {
      id: authUser.id,
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
      role: authUser.user_metadata?.role || 'user'
    };

    // Try to enrich the auth user with role/profile fields from the users table.
    // If no row exists (e.g. fresh signup), bootstrap one for the current user.
    try {
      const { data: profileById, error: profileByIdError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileByIdError) {
        throw profileByIdError;
      }

      let profile = profileById;
      if (!profile && authUser.email) {
        const { data: profileByEmail, error: profileByEmailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle();

        if (profileByEmailError) {
          throw profileByEmailError;
        }

        profile = profileByEmail;
      }

      if (!profile) {
        const bootstrapPayload = {
          id: authUser.id,
          email: authUser.email,
          full_name: baseUser.full_name || authUser.email,
          role: baseUser.role || 'user'
        };

        const { data: insertedProfile, error: insertError } = await supabase
          .from('users')
          .upsert(bootstrapPayload, { onConflict: 'id' })
          .select('*')
          .maybeSingle();

        if (!insertError && insertedProfile) {
          profile = insertedProfile;
        }
      }

      return profile ? { ...baseUser, ...profile } : baseUser;
    } catch {
      return baseUser;
    }
  },
  logout: async (redirectUrl = '/login') => {
    ensureSupabase();
    await supabase.auth.signOut();

    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },
  redirectToLogin: (returnUrl) => {
    const loginUrl = import.meta.env.VITE_LOGIN_URL || '/login';
    const target = returnUrl ? `${loginUrl}?next=${encodeURIComponent(returnUrl)}` : loginUrl;
    window.location.href = target;
  }
};

const functions = {
  invoke: async (functionName, payload = {}) => {
    ensureSupabase();
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    });

    if (error) {
      throw error;
    }

    return { data };
  }
};

const entityNames = Object.keys(ENTITY_TABLE_MAP);
const entities = entityNames.reduce((acc, name) => {
  acc[name] = createEntityApi(name);
  return acc;
}, {});

export const api = {
  auth,
  functions,
  entities,
  integrations: {
    Core: {
      UploadFile: uploadFile
    }
  }
};

// Compatibility alias for legacy imports during migration.
export const base44 = api;
