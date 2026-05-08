import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data, old_data } = payload;

    // Only notify when status changes TO 'veroeffentlicht'
    if (data?.status !== 'veroeffentlicht' || old_data?.status === 'veroeffentlicht') {
      return Response.json({ skipped: true });
    }

    const artistEmail = data.artist_email;
    const artistName = data.artist_name || artistEmail;
    const courseTitle = data.title || 'Dein Kurs';
    const courseId = data.id;

    // Public booking link
    const bookingUrl = `https://coconcolore-booking.de/kurs/${courseId}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'cocon coloré',
      to: artistEmail,
      subject: `✅ Dein Kurs „${courseTitle}" ist jetzt veröffentlicht!`,
      body: `Hallo ${artistName},

großartige Neuigkeiten! Dein Kurs „${courseTitle}" wurde freigegeben und ist jetzt öffentlich buchbar. 🎨

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 DEIN BUCHUNGSLINK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${bookingUrl}

Teile diesen Link gerne überall:
• In sozialen Medien (Instagram, Facebook)
• Auf deiner Website
• Per WhatsApp an Freunde & Bekannte

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BUCHUNGEN VERWALTEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alle Buchungen und Einnahmen siehst du in deinem Dashboard:
https://coconcolore-booking.de/courses/${courseId}

Du bekommst außerdem eine E-Mail-Benachrichtigung, sobald jemand bucht!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bei Fragen: email@coconcolore.de

Viel Erfolg mit deinem Kurs!
Dein cocon coloré Team`,
    });

    return Response.json({ success: true, notified: artistEmail, bookingUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});