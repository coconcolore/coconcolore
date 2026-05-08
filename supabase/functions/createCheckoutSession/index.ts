import Stripe from 'npm:stripe@14.25.0';
import { createAdminClient } from '../_shared/supabase.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
});

Deno.serve(async (req) => {
  try {
    const {
      course_id,
      quantity,
      customer_name,
      customer_email,
      notes,
      success_url,
      cancel_url
    } = await req.json();

    const admin = createAdminClient();

    const { data: course, error: courseError } = await admin
      .from('course')
      .select('*')
      .eq('id', course_id)
      .maybeSingle();

    if (courseError) {
      throw courseError;
    }

    if (!course) {
      return Response.json({ error: 'Kurs nicht gefunden' }, { status: 404 });
    }

    const { data: settings, error: settingsError } = await admin
      .from('platform_settings')
      .select('commission_percent')
      .order('created_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    const commission = settings?.commission_percent ?? 15;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: course.title,
              description: course.description?.slice(0, 200) || undefined,
              images: course.image_url ? [course.image_url] : []
            },
            unit_amount: Math.round(Number(course.price) * 100)
          },
          quantity
        }
      ],
      customer_email,
      metadata: {
        course_id: String(course.id),
        course_title: String(course.title),
        customer_name: String(customer_name ?? ''),
        customer_email: String(customer_email ?? ''),
        notes: String(notes ?? ''),
        quantity: String(quantity ?? 1),
        commission_percent: String(commission)
      },
      success_url,
      cancel_url
    });

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
