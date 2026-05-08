-- Harden RLS policies after initial bootstrap migration.
-- Requires: 20260507_000001_init_schema_and_rls.sql

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.role
      from public.users u
      where u.id = auth.uid()
         or lower(coalesce(u.email, '')) = public.current_user_email()
      order by case when u.id = auth.uid() then 0 else 1 end
      limit 1
    ),
    nullif(lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')), ''),
    nullif(lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')), ''),
    'user'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'kuenstler_manager');
$$;

create or replace function public.is_location_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'location_manager');
$$;

create or replace function public.can_manage_content()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'kuenstler_manager', 'location_manager');
$$;

create or replace function public.is_artist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'kuenstler_manager', 'kuenstler');
$$;

create or replace function public.prevent_unprivileged_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_manager() then
    raise exception 'Only admin or kuenstler_manager can change roles';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_user_role_change on public.users;
create trigger enforce_user_role_change
before update on public.users
for each row execute function public.prevent_unprivileged_role_change();

-- Drop permissive bootstrap policies

drop policy if exists "users authenticated full access" on public.users;

drop policy if exists "artist_profile public approved read" on public.artist_profile;
drop policy if exists "artist_profile authenticated full access" on public.artist_profile;

drop policy if exists "course public published read" on public.course;
drop policy if exists "course authenticated full access" on public.course;

drop policy if exists "lesson public read" on public.lesson;
drop policy if exists "lesson authenticated full access" on public.lesson;

drop policy if exists "booking authenticated full access" on public.booking;
drop policy if exists "enrollment authenticated full access" on public.enrollment;
drop policy if exists "invoice authenticated full access" on public.invoice;
drop policy if exists "payout_request authenticated full access" on public.payout_request;

drop policy if exists "platform_settings public read" on public.platform_settings;
drop policy if exists "platform_settings authenticated full access" on public.platform_settings;

drop policy if exists "room authenticated full access" on public.room;
drop policy if exists "calendar_slot authenticated full access" on public.calendar_slot;

-- users
create policy "users self or manager read"
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or lower(coalesce(email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "users self insert"
on public.users
for insert
to authenticated
with check (
  id = auth.uid()
  or lower(coalesce(email, '')) = public.current_user_email()
);

create policy "users self or manager update"
on public.users
for update
to authenticated
using (
  id = auth.uid()
  or lower(coalesce(email, '')) = public.current_user_email()
  or public.is_manager()
)
with check (
  id = auth.uid()
  or lower(coalesce(email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "users self or manager delete"
on public.users
for delete
to authenticated
using (
  id = auth.uid()
  or lower(coalesce(email, '')) = public.current_user_email()
  or public.is_manager()
);

-- artist_profile
create policy "artist profile public approved read"
on public.artist_profile
for select
to anon
using (is_approved = true);

create policy "artist profile auth own or manager read"
on public.artist_profile
for select
to authenticated
using (
  is_approved = true
  or lower(coalesce(user_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "artist profile own or manager insert"
on public.artist_profile
for insert
to authenticated
with check (
  lower(coalesce(user_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "artist profile own or manager update"
on public.artist_profile
for update
to authenticated
using (
  lower(coalesce(user_email, '')) = public.current_user_email()
  or public.is_manager()
)
with check (
  lower(coalesce(user_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "artist profile own or manager delete"
on public.artist_profile
for delete
to authenticated
using (
  lower(coalesce(user_email, '')) = public.current_user_email()
  or public.is_manager()
);

-- course
create policy "course public published read"
on public.course
for select
to anon
using (status = 'veroeffentlicht');

create policy "course auth published own or manager read"
on public.course
for select
to authenticated
using (
  status = 'veroeffentlicht'
  or lower(coalesce(artist_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "course artist or manager insert"
on public.course
for insert
to authenticated
with check (
  (
    public.is_artist()
    and lower(coalesce(artist_email, '')) = public.current_user_email()
  )
  or public.is_manager()
);

create policy "course owner or manager update"
on public.course
for update
to authenticated
using (
  lower(coalesce(artist_email, '')) = public.current_user_email()
  or public.is_manager()
)
with check (
  public.is_manager()
  or (
    lower(coalesce(artist_email, '')) = public.current_user_email()
    and coalesce(status, 'entwurf') in ('entwurf', 'ausstehend_freigabe')
  )
);

create policy "course owner or manager delete"
on public.course
for delete
to authenticated
using (
  lower(coalesce(artist_email, '')) = public.current_user_email()
  or public.is_manager()
);

-- lesson
create policy "lesson public read for published course"
on public.lesson
for select
to anon
using (
  exists (
    select 1
    from public.course c
    where c.id = course_id
      and c.status = 'veroeffentlicht'
  )
);

create policy "lesson auth owner manager or published read"
on public.lesson
for select
to authenticated
using (
  exists (
    select 1
    from public.course c
    where c.id = course_id
      and (
        c.status = 'veroeffentlicht'
        or lower(coalesce(c.artist_email, '')) = public.current_user_email()
        or public.is_manager()
      )
  )
);

create policy "lesson owner or manager insert"
on public.lesson
for insert
to authenticated
with check (
  exists (
    select 1
    from public.course c
    where c.id = course_id
      and (
        lower(coalesce(c.artist_email, '')) = public.current_user_email()
        or public.is_manager()
      )
  )
);

create policy "lesson owner or manager update"
on public.lesson
for update
to authenticated
using (
  exists (
    select 1
    from public.course c
    where c.id = course_id
      and (
        lower(coalesce(c.artist_email, '')) = public.current_user_email()
        or public.is_manager()
      )
  )
)
with check (
  exists (
    select 1
    from public.course c
    where c.id = course_id
      and (
        lower(coalesce(c.artist_email, '')) = public.current_user_email()
        or public.is_manager()
      )
  )
);

create policy "lesson owner or manager delete"
on public.lesson
for delete
to authenticated
using (
  exists (
    select 1
    from public.course c
    where c.id = course_id
      and (
        lower(coalesce(c.artist_email, '')) = public.current_user_email()
        or public.is_manager()
      )
  )
);

-- booking
create policy "booking own related or manager read"
on public.booking
for select
to authenticated
using (
  lower(coalesce(customer_email, '')) = public.current_user_email()
  or exists (
    select 1
    from public.course c
    where c.id = course_id
      and lower(coalesce(c.artist_email, '')) = public.current_user_email()
  )
  or public.is_manager()
);

create policy "booking own insert"
on public.booking
for insert
to authenticated
with check (
  lower(coalesce(customer_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "booking manager update"
on public.booking
for update
to authenticated
using (
  public.is_manager()
)
with check (
  public.is_manager()
);

create policy "booking manager delete"
on public.booking
for delete
to authenticated
using (public.is_manager());

-- enrollment
create policy "enrollment own or manager read"
on public.enrollment
for select
to authenticated
using (
  lower(coalesce(user_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "enrollment own or manager insert"
on public.enrollment
for insert
to authenticated
with check (
  lower(coalesce(user_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "enrollment manager update"
on public.enrollment
for update
to authenticated
using (
  public.is_manager()
)
with check (
  public.is_manager()
);

create policy "enrollment manager delete"
on public.enrollment
for delete
to authenticated
using (public.is_manager());

-- invoice
create policy "invoice manager read"
on public.invoice
for select
to authenticated
using (public.is_manager());

create policy "invoice manager write"
on public.invoice
for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

-- payout_request
create policy "payout own or manager read"
on public.payout_request
for select
to authenticated
using (
  lower(coalesce(artist_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "payout own or manager insert"
on public.payout_request
for insert
to authenticated
with check (
  lower(coalesce(artist_email, '')) = public.current_user_email()
  or public.is_manager()
);

create policy "payout manager update"
on public.payout_request
for update
to authenticated
using (
  public.is_manager()
)
with check (
  public.is_manager()
);

create policy "payout manager delete"
on public.payout_request
for delete
to authenticated
using (public.is_manager());

-- platform_settings
create policy "platform settings public read"
on public.platform_settings
for select
to anon
using (true);

create policy "platform settings auth read"
on public.platform_settings
for select
to authenticated
using (true);

create policy "platform settings manager write"
on public.platform_settings
for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

-- room
create policy "room auth read"
on public.room
for select
to authenticated
using (true);

create policy "room manager write"
on public.room
for all
to authenticated
using (public.can_manage_content())
with check (public.can_manage_content());

-- calendar_slot
create policy "slot auth read"
on public.calendar_slot
for select
to authenticated
using (true);

create policy "slot manager full write"
on public.calendar_slot
for all
to authenticated
using (public.can_manage_content())
with check (public.can_manage_content());

create policy "slot artist can reserve free slots"
on public.calendar_slot
for update
to authenticated
using (
  public.is_artist()
  and status = 'frei'
)
with check (
  public.is_artist()
  and lower(coalesce(booked_by_email, '')) = public.current_user_email()
  and status = 'gebucht'
);
