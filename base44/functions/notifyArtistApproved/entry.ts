import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data, old_data } = payload;

    // Only notify if is_approved changed from false/null to true
    if (!data?.is_approved || old_data?.is_approved === true) {
      return Response.json({ skipped: true });
    }

    const artistEmail = data.user_email;
    const artistName = data.display_name || artistEmail;

    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'cocon coloré',
      to: artistEmail,
      subject: '🎉 Dein Künstlerprofil ist freigeschaltet!',
      body: `Hallo ${artistName},

herzlich willkommen bei cocon coloré! Dein Künstlerprofil wurde erfolgreich freigeschaltet. 🎨

Ab sofort stehen dir folgende Funktionen zur Verfügung:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 DEINE MÖGLICHKEITEN AUF COCON COLORÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 KURSE ERSTELLEN
Erstelle deine eigenen Workshops & Kurse mit Datum, Uhrzeit, Ort und Preis.
→ https://coconcolore-booking.de/courses/new

🗓️ ZEITSLOTS BUCHEN
Wähle aus freien Kalender-Slots im Shared Kalender für deine Veranstaltungen.
→ https://coconcolore-booking.de/kalender

👤 DEIN PROFIL VERVOLLSTÄNDIGEN
Füge Bio, Profilbild, Website & Instagram hinzu – das sehen Teilnehmer auf deiner öffentlichen Seite.
→ https://coconcolore-booking.de/profil

💰 EINNAHMEN VERFOLGEN
Sieh dir deine Buchungen und Einnahmen jederzeit in der Abrechnung an.
→ https://coconcolore-booking.de/invoices

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📩 BENACHRICHTIGUNGEN
Du erhältst automatisch eine E-Mail, wenn:
• Dein Kurs freigegeben & veröffentlicht wird
• Jemand einen deiner Kurse bucht

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bei Fragen erreichst du uns unter:
email@coconcolore.de

Wir freuen uns auf die Zusammenarbeit!
Dein cocon coloré Team`,
    });

    return Response.json({ success: true, notified: artistEmail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});