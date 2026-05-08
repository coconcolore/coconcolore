import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data, event } = payload;

    // Only handle new paid bookings
    if (event?.type !== 'create' || data?.payment_status !== 'bezahlt') {
      return Response.json({ skipped: true });
    }

    const courseId = data.course_id;
    if (!courseId) return Response.json({ skipped: true, reason: 'no course_id' });

    // Fetch course to get artist info
    const courses = await base44.asServiceRole.entities.Course.filter({ id: courseId });
    const course = courses[0];
    if (!course?.artist_email) return Response.json({ skipped: true, reason: 'no artist_email' });

    const artistEmail = course.artist_email;
    const artistName = course.artist_name || artistEmail;
    const courseTitle = course.title || 'Dein Kurs';
    const customerName = data.customer_name || data.customer_email || 'Ein Teilnehmer';
    const customerEmail = data.customer_email || '';
    const amountTotal = (data.amount_total || 0).toFixed(2);
    const amountArtist = (data.amount_artist || 0).toFixed(2);
    const amountCommission = (data.amount_commission || 0).toFixed(2);
    const bookingUrl = `https://coconcolore-booking.de/kurs/${courseId}`;
    const dashboardUrl = `https://coconcolore-booking.de/courses/${courseId}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'cocon coloré',
      to: artistEmail,
      subject: `🎉 Neue Buchung für „${courseTitle}"!`,
      body: `Hallo ${artistName},

du hast eine neue Buchung erhalten – herzlichen Glückwunsch! 🎨

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 BUCHUNGSDETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Kurs:          ${courseTitle}
Teilnehmer:    ${customerName}${customerEmail && customerEmail !== customerName ? `\nE-Mail:        ${customerEmail}` : ''}

Gesamtbetrag:  ${amountTotal} €
Dein Anteil:   ${amountArtist} €
Provision:     ${amountCommission} €

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Kursseite ansehen:
${bookingUrl}

📊 Buchungsübersicht (Dashboard):
${dashboardUrl}

Bei Fragen stehen wir dir jederzeit zur Verfügung.

Viele Grüße,
Dein cocon coloré Team
email@coconcolore.de`,
    });

    return Response.json({ success: true, notified: artistEmail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});