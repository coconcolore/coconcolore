-- Allow public course-page bookings to be created by anonymous visitors.
-- Keep the policy narrow: only published courses, only pending bookings.

drop policy if exists "booking public insert" on public.booking;

create policy "booking public insert"
on public.booking
for insert
to anon
with check (
  payment_status = 'ausstehend'
  and customer_email is not null
  and btrim(customer_email) <> ''
  and exists (
    select 1
    from public.course c
    where c.id = course_id
      and c.status = 'veroeffentlicht'
  )
);