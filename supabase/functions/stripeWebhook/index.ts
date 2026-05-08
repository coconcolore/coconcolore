import Stripe from 'npm:stripe@14.25.0';
import { createAdminClient } from '../_shared/supabase.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  try {
    const admin = createAdminClient();
    const bodyText = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;
    if (webhookSecret && signature) {
      event = await stripe.webhooks.constructEventAsync(bodyText, signature, webhookSecret);
    } else {
      event = JSON.parse(bodyText);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};

      const quantity = Number.parseInt(meta.quantity || '1', 10);
      const amountTotal = Number(session.amount_total || 0) / 100;
      const pricePerTicket = quantity > 0 ? amountTotal / quantity : amountTotal;
      const commissionPct = Number.parseFloat(meta.commission_percent || '15');

      for (let i = 0; i < quantity; i += 1) {
        const { error: insertError } = await admin.from('booking').insert({
          course_id: meta.course_id,
          customer_name: meta.customer_name,
          customer_email: meta.customer_email,
          notes: meta.notes || null,
          amount_total: pricePerTicket,
          amount_commission: (pricePerTicket * commissionPct) / 100,
          amount_artist: pricePerTicket - (pricePerTicket * commissionPct) / 100,
          payment_status: 'bezahlt',
          stripe_payment_intent: session.payment_intent || null
        });

        if (insertError) {
          throw insertError;
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
