import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@test.local';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'Admin12345!';
const ARTIST_EMAIL = process.env.SMOKE_ARTIST_EMAIL || 'kuenstler@test.local';
const ARTIST_PASSWORD = process.env.SMOKE_ARTIST_PASSWORD || 'Artist12345!';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const createAnonClient = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  });

const createAuthedClient = (accessToken) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

const assertNoError = (error, step) => {
  if (error) {
    throw new Error(`${step} failed: ${error.message}`);
  }
};

const ensureSchemaReady = async (client) => {
  const requiredTables = ['artist_profile', 'course', 'room', 'calendar_slot'];

  for (const table of requiredTables) {
    const { error } = await client.from(table).select('id', { head: true, count: 'exact' });
    if (error) {
      throw new Error(
        `Schema not ready: table public.${table} is unavailable (${error.message}). `
        + 'Run migrations 000001, 000002 and 000003 in Supabase SQL Editor first.'
      );
    }
  }
};

const signIn = async (email, password, label) => {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assertNoError(error, `${label} sign in`);

  const token = data?.session?.access_token;
  if (!token) {
    throw new Error(`${label} sign in failed: no access token`);
  }

  return {
    user: data.user,
    token,
    client: createAuthedClient(token)
  };
};

const run = async () => {
  console.log('--- Smoke Test Flow Start ---');

  const unique = Date.now();
  const roomName = `Smoke Room ${unique}`;
  const courseTitle = `Smoke Kurs ${unique}`;

  const artistAuth = await signIn(ARTIST_EMAIL, ARTIST_PASSWORD, 'Artist');
  const adminAuth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');

  await ensureSchemaReady(adminAuth.client);

  console.log(`Artist login ok: ${artistAuth.user.email}`);
  console.log(`Admin login ok: ${adminAuth.user.email}`);

  // 1) Artist fills profile data
  const profilePayload = {
    user_email: ARTIST_EMAIL,
    display_name: 'Smoke Test Artist',
    bio: 'Smoke Test Bio',
    phone: '+49 123 456789',
    invoice_name: 'Smoke Test Artist',
    invoice_street: 'Musterstr. 1',
    invoice_zip: '10115',
    invoice_city: 'Berlin',
    invoice_country: 'Deutschland',
    invoice_tax_id: 'DE123456789',
    is_approved: false
  };

  const { data: existingProfile, error: existingProfileError } = await artistAuth.client
    .from('artist_profile')
    .select('id')
    .eq('user_email', ARTIST_EMAIL)
    .maybeSingle();
  assertNoError(existingProfileError, 'fetch artist profile');

  if (existingProfile?.id) {
    const { error } = await artistAuth.client
      .from('artist_profile')
      .update(profilePayload)
      .eq('id', existingProfile.id);
    assertNoError(error, 'update artist profile');
  } else {
    const { error } = await artistAuth.client
      .from('artist_profile')
      .insert(profilePayload);
    assertNoError(error, 'insert artist profile');
  }
  console.log('Artist profile upsert ok');

  // 2) Artist suggests course
  const coursePayload = {
    title: courseTitle,
    description: 'Smoke Test Kursvorschlag',
    price: 79,
    status: 'ausstehend_freigabe',
    artist_email: ARTIST_EMAIL,
    artist_name: 'Smoke Test Artist',
    category: 'malerei',
    level: 'anfaenger'
  };

  const { data: createdCourse, error: createCourseError } = await artistAuth.client
    .from('course')
    .insert(coursePayload)
    .select('*')
    .single();
  assertNoError(createCourseError, 'artist create suggested course');
  console.log(`Course suggested: ${createdCourse.id}`);

  // 3) Admin can view pending course
  const { data: pendingCourses, error: pendingError } = await adminAuth.client
    .from('course')
    .select('*')
    .eq('id', createdCourse.id)
    .eq('status', 'ausstehend_freigabe');
  assertNoError(pendingError, 'admin fetch pending course');
  if (!pendingCourses || pendingCourses.length !== 1) {
    throw new Error('Pending course is not visible to admin');
  }
  console.log('Admin sees pending course');

  // 4) Ensure publish before artist approval is blocked
  const { error: publishBeforeApprovalError } = await adminAuth.client
    .from('course')
    .update({ status: 'veroeffentlicht' })
    .eq('id', createdCourse.id)
    .select('*')
    .single();

  if (!publishBeforeApprovalError) {
    throw new Error('Business rule broken: course published before artist approval');
  }
  console.log('Publish-before-approval blocked as expected');

  // 5) Admin approves artist
  const { error: approveArtistError } = await adminAuth.client
    .from('artist_profile')
    .update({ is_approved: true })
    .eq('user_email', ARTIST_EMAIL);
  assertNoError(approveArtistError, 'admin approve artist');
  console.log('Artist approved by admin');

  // 6) Admin publishes course
  const { data: publishedCourse, error: publishError } = await adminAuth.client
    .from('course')
    .update({ status: 'veroeffentlicht' })
    .eq('id', createdCourse.id)
    .select('*')
    .single();
  assertNoError(publishError, 'admin publish course');

  if (publishedCourse.status !== 'veroeffentlicht') {
    throw new Error('Course status is not veroeffentlicht after admin publish');
  }
  console.log('Course published by admin');

  // 7) Admin creates room
  const { data: room, error: roomError } = await adminAuth.client
    .from('room')
    .insert({
      name: roomName,
      description: 'Smoke test room',
      capacity: 10,
      is_bookable: true
    })
    .select('*')
    .single();
  assertNoError(roomError, 'admin create room');
  console.log(`Room created: ${room.id}`);

  // 8) Admin creates free slot
  const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const { data: slot, error: slotError } = await adminAuth.client
    .from('calendar_slot')
    .insert({
      title: `Smoke Slot ${unique}`,
      start_datetime: start.toISOString(),
      end_datetime: end.toISOString(),
      room_id: room.id,
      max_bookings: 1,
      status: 'frei'
    })
    .select('*')
    .single();
  assertNoError(slotError, 'admin create free slot');
  console.log(`Slot created: ${slot.id}`);

  // 9) Artist books free slot
  const { data: bookedSlot, error: bookError } = await artistAuth.client
    .from('calendar_slot')
    .update({
      status: 'gebucht',
      booked_by_email: ARTIST_EMAIL,
      booked_by_name: 'Smoke Test Artist'
    })
    .eq('id', slot.id)
    .select('*')
    .single();
  assertNoError(bookError, 'artist book free slot');

  if (bookedSlot.status !== 'gebucht' || (bookedSlot.booked_by_email || '').toLowerCase() !== ARTIST_EMAIL.toLowerCase()) {
    throw new Error('Slot booking verification failed');
  }
  console.log('Artist booked slot successfully');

  console.log('--- Smoke Test Flow PASS ---');
  console.log(JSON.stringify({
    courseId: createdCourse.id,
    roomId: room.id,
    slotId: slot.id
  }, null, 2));
};

run().catch((error) => {
  console.error('--- Smoke Test Flow FAIL ---');
  console.error(error.message || error);
  process.exit(1);
});
