-- Enforce business rule:
-- A course can only be published if the corresponding artist profile is approved.

create or replace function public.enforce_course_publish_requires_artist_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  artist_is_approved boolean;
begin
  if new.status = 'veroeffentlicht' then
    if coalesce(new.artist_email, '') = '' then
      raise exception 'artist_email is required before publishing a course';
    end if;

    select ap.is_approved
      into artist_is_approved
      from public.artist_profile ap
     where lower(ap.user_email) = lower(new.artist_email)
     limit 1;

    if coalesce(artist_is_approved, false) = false then
      raise exception 'Artist must be approved before course can be published';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_course_publish_on_course on public.course;
create trigger enforce_course_publish_on_course
before insert or update on public.course
for each row execute function public.enforce_course_publish_requires_artist_approval();
