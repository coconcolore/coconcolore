import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data, old_data } = payload;

    // Only act if is_approved changed to true
    if (!data?.is_approved || old_data?.is_approved === true) {
      return Response.json({ skipped: true });
    }

    const artistEmail = data.user_email;

    // Find the user by email
    const users = await base44.asServiceRole.entities.User.filter({ email: artistEmail });
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found', email: artistEmail }, { status: 404 });
    }

    const user = users[0];

    // Only update if not already a higher role
    if (user.role === 'admin' || user.role === 'kuenstler_manager' || user.role === 'kuenstler') {
      return Response.json({ skipped: true, reason: 'already has elevated role', role: user.role });
    }

    await base44.asServiceRole.entities.User.update(user.id, { role: 'kuenstler' });

    return Response.json({ success: true, updated: artistEmail, newRole: 'kuenstler' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});