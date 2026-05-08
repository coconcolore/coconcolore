-- Initial Supabase schema + baseline RLS for migration from Base44

create extension if not exists pgcrypto;

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  full_name text,
  role text not null default 'user' check (role in ('admin','kuenstler_manager','kuenstler','location_manager','user')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.artist_profile (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  display_name text not null,
  bio text,
  avatar_url text,
  website text,
  instagram text,
  specialties text[] default '{}',
  invoice_name text,
  invoice_street text,
  invoice_zip text,
  invoice_city text,
  invoice_country text default 'Deutschland',
  invoice_address text,
  invoice_tax_id text,
  invoice_bank_info text,
  phone text,
  iban text,
  stripe_account_id text,
  stripe_onboarding_complete boolean not null default false,
  is_approved boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.course (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price numeric(12,2) not null,
  image_url text,
  category text check (category in ('malerei','zeichnung','fotografie','skulptur','digitale_kunst','musik','tanz','sonstiges')),
  status text not null default 'entwurf' check (status in ('entwurf','ausstehend_freigabe','veroeffentlicht','archiviert')),
  level text not null default 'anfaenger' check (level in ('anfaenger','fortgeschritten','profi')),
  duration_hours numeric(8,2),
  artist_email text,
  artist_name text,
  event_date timestamptz,
  location text,
  min_participants integer,
  max_participants integer,
  admin_notes text,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.lesson (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.course(id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  "order" integer,
  is_free_preview boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.booking (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.course(id) on delete set null,
  customer_name text,
  customer_email text not null,
  amount_total numeric(12,2),
  amount_artist numeric(12,2),
  amount_commission numeric(12,2),
  payment_status text not null default 'ausstehend' check (payment_status in ('ausstehend','bezahlt','erstattet')),
  stripe_payment_intent text,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.enrollment (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.course(id) on delete cascade,
  user_email text not null,
  payment_status text not null default 'ausstehend' check (payment_status in ('ausstehend','bezahlt','erstattet')),
  amount_paid numeric(12,2),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.invoice (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  client_name text not null,
  client_email text,
  client_address text,
  items jsonb default '[]'::jsonb,
  subtotal numeric(12,2),
  tax_rate numeric(6,2) default 19,
  tax_amount numeric(12,2),
  total_amount numeric(12,2) not null,
  status text not null default 'entwurf' check (status in ('entwurf','gesendet','bezahlt','storniert')),
  due_date date,
  notes text,
  course_id uuid references public.course(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.payout_request (
  id uuid primary key default gen_random_uuid(),
  artist_email text not null,
  artist_name text,
  iban text not null,
  amount numeric(12,2) not null,
  status text not null default 'beantragt' check (status in ('beantragt','verarbeitet','abgelehnt')),
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  commission_percent numeric(6,2) not null default 15,
  platform_name text default 'KursStudio',
  platform_email text,
  stripe_publishable_key text,
  welcome_message text,
  legal_impressum text,
  legal_agb text,
  legal_datenschutz text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.room (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  capacity integer,
  size_sqm numeric(10,2),
  equipment text[] default '{}',
  image_urls text[] default '{}',
  is_bookable boolean not null default true,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.calendar_slot (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  location text,
  room_id uuid references public.room(id) on delete set null,
  max_bookings integer not null default 1,
  booked_by_email text,
  booked_by_name text,
  status text not null default 'frei' check (status in ('frei','gebucht','gesperrt')),
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists idx_course_status on public.course(status);
create index if not exists idx_course_artist_email on public.course(artist_email);
create index if not exists idx_booking_course_id on public.booking(course_id);
create index if not exists idx_booking_payment_status on public.booking(payment_status);
create index if not exists idx_lesson_course_id on public.lesson(course_id);
create index if not exists idx_payout_artist_email on public.payout_request(artist_email);
create index if not exists idx_payout_status on public.payout_request(status);
create index if not exists idx_calendar_slot_start on public.calendar_slot(start_datetime);
create index if not exists idx_calendar_slot_status on public.calendar_slot(status);
create index if not exists idx_artist_profile_user_email on public.artist_profile(user_email);

create trigger set_users_updated_date before update on public.users
for each row execute function public.set_updated_date();

create trigger set_artist_profile_updated_date before update on public.artist_profile
for each row execute function public.set_updated_date();

create trigger set_course_updated_date before update on public.course
for each row execute function public.set_updated_date();

create trigger set_lesson_updated_date before update on public.lesson
for each row execute function public.set_updated_date();

create trigger set_booking_updated_date before update on public.booking
for each row execute function public.set_updated_date();

create trigger set_enrollment_updated_date before update on public.enrollment
for each row execute function public.set_updated_date();

create trigger set_invoice_updated_date before update on public.invoice
for each row execute function public.set_updated_date();

create trigger set_payout_request_updated_date before update on public.payout_request
for each row execute function public.set_updated_date();

create trigger set_platform_settings_updated_date before update on public.platform_settings
for each row execute function public.set_updated_date();

create trigger set_room_updated_date before update on public.room
for each row execute function public.set_updated_date();

create trigger set_calendar_slot_updated_date before update on public.calendar_slot
for each row execute function public.set_updated_date();

insert into public.platform_settings (commission_percent, platform_name)
select 15, 'KursStudio'
where not exists (select 1 from public.platform_settings);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    'user'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_date = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.artist_profile enable row level security;
alter table public.course enable row level security;
alter table public.lesson enable row level security;
alter table public.booking enable row level security;
alter table public.enrollment enable row level security;
alter table public.invoice enable row level security;
alter table public.payout_request enable row level security;
alter table public.platform_settings enable row level security;
alter table public.room enable row level security;
alter table public.calendar_slot enable row level security;

-- Baseline policies: keep app functional after migration. Harden later by role/resource ownership.
create policy "users authenticated full access"
on public.users
for all
to authenticated
using (true)
with check (true);

create policy "artist_profile public approved read"
on public.artist_profile
for select
to anon
using (is_approved = true);

create policy "artist_profile authenticated full access"
on public.artist_profile
for all
to authenticated
using (true)
with check (true);

create policy "course public published read"
on public.course
for select
to anon
using (status = 'veroeffentlicht');

create policy "course authenticated full access"
on public.course
for all
to authenticated
using (true)
with check (true);

create policy "lesson public read"
on public.lesson
for select
to anon
using (true);

create policy "lesson authenticated full access"
on public.lesson
for all
to authenticated
using (true)
with check (true);

create policy "booking authenticated full access"
on public.booking
for all
to authenticated
using (true)
with check (true);

create policy "enrollment authenticated full access"
on public.enrollment
for all
to authenticated
using (true)
with check (true);

create policy "invoice authenticated full access"
on public.invoice
for all
to authenticated
using (true)
with check (true);

create policy "payout_request authenticated full access"
on public.payout_request
for all
to authenticated
using (true)
with check (true);

create policy "platform_settings public read"
on public.platform_settings
for select
to anon
using (true);

create policy "platform_settings authenticated full access"
on public.platform_settings
for all
to authenticated
using (true)
with check (true);

create policy "room authenticated full access"
on public.room
for all
to authenticated
using (true)
with check (true);

create policy "calendar_slot authenticated full access"
on public.calendar_slot
for all
to authenticated
using (true)
with check (true);

-- Storage baseline for file uploads used by the frontend adapter.
insert into storage.buckets (id, name, public)
values ('public', 'public', true)
on conflict (id) do nothing;

create policy "public bucket read"
on storage.objects
for select
to anon
using (bucket_id = 'public');

create policy "public bucket authenticated write"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'public');

create policy "public bucket authenticated update"
on storage.objects
for update
to authenticated
using (bucket_id = 'public')
with check (bucket_id = 'public');

create policy "public bucket authenticated delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'public');
