import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { course_id, quantity, customer_name, customer_email, notes, success_url, cancel_url } = await req.json();

    // Use service role — called by unauthenticated public users
    const courses = await base44.asServiceRole.entities.Course.filter({ id: course_id });
    const course = courses[0];
    if (!course) {
      return Response.json({ error: 'Kurs nicht gefunden' }, { status: 404 });
    }

    const settings = await base44.asServiceRole.entities.PlatformSettings.list();
    const commission = settings[0]?.commission_percent ?? 15;

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
              images: course.image_url ? [course.image_url] : [],
            },
            unit_amount: Math.round(course.price * 100),
          },
          quantity: quantity,
        },
      ],
      customer_email: customer_email,
      metadata: {
        course_id: course.id,
        course_title: course.title,
        customer_name,
        customer_email,
        notes: notes || '',
        quantity: String(quantity),
        commission_percent: String(commission),
      },
      success_url: success_url,
      cancel_url: cancel_url,
    });

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});