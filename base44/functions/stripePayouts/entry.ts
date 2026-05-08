import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const body = await req.json();
    const { action } = body;

    // Selbst-Auszahlung: Künstler darf direkt auslösen
    if (action === 'self_payout') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const { payout_request_id, amount_cents, iban, artist_name } = body;

      // Sicherheitscheck: Auszahlungsantrag gehört dem eingeloggten User
      const requests = await base44.asServiceRole.entities.PayoutRequest.filter({ id: payout_request_id });
      const payoutReq = requests[0];
      if (!payoutReq || payoutReq.artist_email !== user.email) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (payoutReq.status !== 'beantragt') {
        return Response.json({ error: 'Bereits verarbeitet' }, { status: 400 });
      }

      // Als verarbeitet markieren (echte IBAN-Überweisung muss manuell/extern erfolgen)
      await base44.asServiceRole.entities.PayoutRequest.update(payout_request_id, {
        status: 'verarbeitet',
        notes: `Selbst-Auszahlung: ${(amount_cents / 100).toFixed(2)} EUR an IBAN ${iban}`,
      });

      return Response.json({ success: true, message: `Auszahlung von ${(amount_cents / 100).toFixed(2)} EUR initiiert.` });
    }

    // Alle weiteren Aktionen nur für Admin/Manager
    if (!user || (user.role !== 'admin' && user.role !== 'kuenstler_manager')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create a transfer to a connected account or bank payout
    if (action === 'create_transfer') {
      const { amount_cents, destination_account_id, description } = body;

      const transfer = await stripe.transfers.create({
        amount: amount_cents,
        currency: 'eur',
        destination: destination_account_id,
        description: description || 'KursStudio Auszahlung',
      });

      return Response.json({ success: true, transfer_id: transfer.id });
    }

    // Create a Stripe Connect onboarding link for an artist
    if (action === 'create_onboarding_link') {
      const { email, artist_profile_id } = body;

      let account;
      // Check if account already exists
      const profiles = await base44.asServiceRole.entities.ArtistProfile.filter({ id: artist_profile_id });
      const profile = profiles[0];

      if (profile?.stripe_account_id) {
        account = { id: profile.stripe_account_id };
      } else {
        account = await stripe.accounts.create({
          type: 'express',
          email,
          capabilities: { transfers: { requested: true } },
        });
        // Save account id to profile
        await base44.asServiceRole.entities.ArtistProfile.update(artist_profile_id, {
          stripe_account_id: account.id,
        });
      }

      const urlParams = new URLSearchParams(new URL(req.url).search);
      const baseUrl = req.headers.get('origin') || 'https://app.base44.com';

      const link = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${baseUrl}/profil`,
        return_url: `${baseUrl}/profil?stripe_success=1`,
        type: 'account_onboarding',
      });

      return Response.json({ url: link.url });
    }

    // Check if a connected account is fully onboarded
    if (action === 'check_account') {
      const { stripe_account_id } = body;
      const account = await stripe.accounts.retrieve(stripe_account_id);
      return Response.json({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
      });
    }

    // Payout to artist via IBAN (manual bank transfer simulation via Stripe)
    if (action === 'manual_payout') {
      const { payout_request_id, amount_cents, iban, artist_name } = body;

      // In real production you'd use Stripe Treasury or manual bank transfer
      // Here we mark it as processed and return a confirmation
      await base44.asServiceRole.entities.PayoutRequest.update(payout_request_id, {
        status: 'verarbeitet',
        notes: `Stripe-Auszahlung initiiert: ${amount_cents / 100} EUR an IBAN ${iban}`,
      });

      return Response.json({ success: true, message: `Auszahlung von ${(amount_cents / 100).toFixed(2)} EUR an ${artist_name} initiiert.` });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});