-- Allow admins/managers to publish a course directly from ausstehend_freigabe,
-- skipping the freigegeben_intern step. Both previous statuses are now valid.

create or replace function public.enforce_course_workflow_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Non-managers can only work with draft/submission states.
  if not public.is_manager() then
    if tg_op = 'UPDATE' and new.status <> old.status then
      if new.status not in ('entwurf', 'ausstehend_freigabe') then
        raise exception 'Only admin or kuenstler_manager may set this course status';
      end if;
    elsif tg_op = 'INSERT' then
      if coalesce(new.status, 'entwurf') not in ('entwurf', 'ausstehend_freigabe') then
        raise exception 'Only admin or kuenstler_manager may set this course status';
      end if;
    end if;
  end if;

  -- Publishing is allowed from ausstehend_freigabe or freigegeben_intern.
  if tg_op = 'UPDATE' then
    if new.status = 'veroeffentlicht' and new.status <> old.status
       and coalesce(old.status, '') not in ('freigegeben_intern', 'ausstehend_freigabe') then
      raise exception 'Course must be pending or internally approved before publishing';
    end if;
  elsif tg_op = 'INSERT' then
    if new.status = 'veroeffentlicht' then
      raise exception 'Course must be pending or internally approved before publishing';
    end if;
  end if;

  -- Rejection should always include a note for the artist.
  if new.status = 'abgelehnt' and coalesce(btrim(new.admin_notes), '') = '' then
    raise exception 'admin_notes are required when rejecting a course';
  end if;

  return new;
end;
$$;
