import { createAdminClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const { course_id } = await req.json();
    if (!course_id) {
      return Response.json({ error: 'course_id required' }, { status: 400, headers: corsHeaders });
    }

    const admin = createAdminClient();

    const { data: course, error: courseError } = await admin
      .from('course')
      .select('*')
      .eq('id', course_id)
      .maybeSingle();

    if (courseError) {
      throw courseError;
    }

    if (!course || course.status !== 'veroeffentlicht') {
      return Response.json({ course: null }, { headers: corsHeaders });
    }

    let artistProfile = null;
    if (course.artist_email) {
      const { data: profile } = await admin
        .from('artist_profile')
        .select('*')
        .eq('user_email', course.artist_email)
        .maybeSingle();
      artistProfile = profile;
    }

    let room = null;
    if (course.room_id) {
      const { data: roomData, error: roomError } = await admin
        .from('room')
        .select('*')
        .eq('id', course.room_id)
        .maybeSingle();

      if (roomError) {
        throw roomError;
      }

      room = roomData;
    }

    const { data: bookings, error: bookingsError } = await admin
      .from('booking')
      .select('*')
      .eq('course_id', course_id);

    if (bookingsError) {
      throw bookingsError;
    }

    const { data: settings, error: settingsError } = await admin
      .from('platform_settings')
      .select('*')
      .order('created_date', { ascending: true });

    if (settingsError) {
      throw settingsError;
    }

    return Response.json({ course, artistProfile, room, bookings: bookings ?? [], settings: settings ?? [] }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500, headers: corsHeaders });
  }
});
