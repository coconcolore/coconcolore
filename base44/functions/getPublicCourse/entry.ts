import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { course_id } = await req.json();

    if (!course_id) {
      return Response.json({ error: 'course_id required' }, { status: 400 });
    }

    // Use service role to fetch without user auth
    const courses = await base44.asServiceRole.entities.Course.filter({ id: course_id });
    const course = courses[0];

    if (!course || course.status !== 'veroeffentlicht') {
      return Response.json({ course: null });
    }

    // Also fetch artist profile
    let artistProfile = null;
    if (course.artist_email) {
      const profiles = await base44.asServiceRole.entities.ArtistProfile.filter({ user_email: course.artist_email });
      artistProfile = profiles[0] || null;
    }

    // Fetch bookings count
    const bookings = await base44.asServiceRole.entities.Booking.filter({ course_id });

    // Fetch platform settings
    const settings = await base44.asServiceRole.entities.PlatformSettings.list();

    return Response.json({ course, artistProfile, bookings, settings });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});