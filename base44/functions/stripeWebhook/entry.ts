import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  if (webhookSecret) {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } else {
    event = JSON.parse(body);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata;

    const quantity = parseInt(meta.quantity || '1');
    const pricePerTicket = session.amount_total / 100 / quantity;
    const commissionPct = parseFloat(meta.commission_percent || '15');

    for (let i = 0; i < quantity; i++) {
      await base44.asServiceRole.entities.Booking.create({
        course_id: meta.course_id,
        customer_name: meta.customer_name,
        customer_email: meta.customer_email,
        notes: meta.notes || undefined,
        amount_total: pricePerTicket,
        amount_commission: (pricePerTicket * commissionPct) / 100,
        amount_artist: pricePerTicket - (pricePerTicket * commissionPct) / 100,
        payment_status: 'bezahlt',
        stripe_payment_intent: session.payment_intent,
      });
    }

    // Send confirmation email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: meta.customer_email,
      subject: `Buchungsbestätigung: ${meta.course_title}`,
      body: buildEmail(meta, quantity, session.amount_total / 100),
    });
  }

  return Response.json({ received: true });
});

function buildEmail(meta, quantity, total) {
  return `Hallo ${meta.customer_name},

vielen Dank für deine Buchung und Zahlung!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUCHUNGSBESTÄTIGUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Kurs:      ${meta.course_title}
Tickets:   ${quantity}×
Betrag:    ${total.toFixed(2)} € (bezahlt ✓)

${meta.notes ? `Deine Anmerkungen: ${meta.notes}` : ''}

Bei Fragen erreichst du uns jederzeit per E-Mail.

Wir freuen uns auf dich!`.trim();
}