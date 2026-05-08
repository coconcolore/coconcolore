import Stripe from 'npm:stripe@14.25.0';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
});

const isManagerRole = (role: string | null | undefined) => role === 'admin' || role === 'kuenstler_manager';

Deno.serve(async (req) => {
  try {
    const admin = createAdminClient();
    const authorization = req.headers.get('Authorization');
    const authUser = await getUserFromRequest(authorization);

    if (!authUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: appUser } = await admin
      .from('users')
      .select('id,email,role')
      .eq('id', authUser.id)
      .maybeSingle();

    const body = await req.json();
    const { action } = body;

    if (action === 'self_payout') {
      const { payout_request_id, amount_cents, iban } = body;

      const { data: payoutReq, error: payoutError } = await admin
        .from('payout_request')
        .select('*')
        .eq('id', payout_request_id)
        .maybeSingle();

      if (payoutError) {
        throw payoutError;
      }

      if (!payoutReq || payoutReq.artist_email !== authUser.email) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (payoutReq.status !== 'beantragt') {
        return Response.json({ error: 'Bereits verarbeitet' }, { status: 400 });
      }

      const { error: updateError } = await admin
        .from('payout_request')
        .update({
          status: 'verarbeitet',
          notes: `Selbst-Auszahlung: ${(amount_cents / 100).toFixed(2)} EUR an IBAN ${iban}`
        })
        .eq('id', payout_request_id);

      if (updateError) {
        throw updateError;
      }

      return Response.json({
        success: true,
        message: `Auszahlung von ${(amount_cents / 100).toFixed(2)} EUR initiiert.`
      });
    }

    if (!isManagerRole(appUser?.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'create_transfer') {
      const { amount_cents, destination_account_id, description } = body;

      const transfer = await stripe.transfers.create({
        amount: amount_cents,
        currency: 'eur',
        destination: destination_account_id,
        description: description || 'KursStudio Auszahlung'
      });

      return Response.json({ success: true, transfer_id: transfer.id });
    }

    if (action === 'create_onboarding_link') {
      const { email, artist_profile_id } = body;

      const { data: profile, error: profileError } = await admin
        .from('artist_profile')
        .select('*')
        .eq('id', artist_profile_id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      let accountId = profile?.stripe_account_id;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          email,
          capabilities: { transfers: { requested: true } }
        });

        accountId = account.id;

        const { error: saveAccountError } = await admin
          .from('artist_profile')
          .update({ stripe_account_id: account.id })
          .eq('id', artist_profile_id);

        if (saveAccountError) {
          throw saveAccountError;
        }
      }

      const origin = req.headers.get('origin') || 'http://localhost:5173';
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/profil`,
        return_url: `${origin}/profil?stripe_success=1`,
        type: 'account_onboarding'
      });

      return Response.json({ url: link.url });
    }

    if (action === 'check_account') {
      const { stripe_account_id } = body;
      const account = await stripe.accounts.retrieve(stripe_account_id);
      return Response.json({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted
      });
    }

    if (action === 'manual_payout') {
      const { payout_request_id, amount_cents, iban, artist_name } = body;

      const { error: updateError } = await admin
        .from('payout_request')
        .update({
          status: 'verarbeitet',
          notes: `Stripe-Auszahlung initiiert: ${(amount_cents / 100).toFixed(2)} EUR an IBAN ${iban}`
        })
        .eq('id', payout_request_id);

      if (updateError) {
        throw updateError;
      }

      return Response.json({
        success: true,
        message: `Auszahlung von ${(amount_cents / 100).toFixed(2)} EUR an ${artist_name} initiiert.`
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
