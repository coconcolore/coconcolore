-- Smoke-test seed helper (run after migrations 000001 + 000002)
-- 1) Create three auth users in Supabase Auth UI first.
-- 2) Replace the emails below.

-- Replace these placeholders:
-- artist@example.com
-- location@example.com
-- admin@example.com

update public.users
set role = 'kuenstler'
where lower(email) = lower('artist@example.com');

update public.users
set role = 'location_manager'
where lower(email) = lower('location@example.com');

update public.users
set role = 'admin'
where lower(email) = lower('admin@example.com');

insert into public.artist_profile (user_email, display_name, is_approved)
select 'artist@example.com', 'Test Artist', true
where not exists (
  select 1 from public.artist_profile where lower(user_email) = lower('artist@example.com')
);

insert into public.room (name, description, capacity, is_bookable)
select 'Raum A', 'Smoke-Test Raum', 12, true
where not exists (
  select 1 from public.room where name = 'Raum A'
);

insert into public.calendar_slot (
  title,
  start_datetime,
  end_datetime,
  room_id,
  status,
  max_bookings
)
select
  'Test-Slot',
  now() + interval '2 day',
  now() + interval '2 day' + interval '2 hour',
  r.id,
  'frei',
  1
from public.room r
where r.name = 'Raum A'
  and not exists (
    select 1
    from public.calendar_slot s
    where s.title = 'Test-Slot'
  );

insert into public.course (
  title,
  description,
  price,
  status,
  artist_email,
  artist_name,
  category,
  level
)
select
  'Smoke Test Kurs',
  'Automatisch erzeugter Testkurs',
  49,
  'veroeffentlicht',
  'artist@example.com',
  'Test Artist',
  'malerei',
  'anfaenger'
where not exists (
  select 1 from public.course where title = 'Smoke Test Kurs' and lower(artist_email) = lower('artist@example.com')
);

insert into public.booking (
  course_id,
  customer_name,
  customer_email,
  amount_total,
  amount_artist,
  amount_commission,
  payment_status
)
select
  c.id,
  'Max Muster',
  'max@example.com',
  49,
  41.65,
  7.35,
  'bezahlt'
from public.course c
where c.title = 'Smoke Test Kurs'
  and not exists (
    select 1 from public.booking b where b.course_id = c.id and b.customer_email = 'max@example.com'
  );
