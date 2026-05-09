-- Fix: workflow guard was blocking any UPDATE on already-published courses.
-- Only enforce the status-transition rules when the status column actually changes.

create or replace function public.enforce_course_workflow_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Non-managers can only work with draft/submission states.
  -- Only check when status changes.
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

  -- Publishing requires the internal approval step first.
  -- Only enforce when the status is actually being changed to 'veroeffentlicht'.
  if tg_op = 'UPDATE' then
    if new.status = 'veroeffentlicht' and new.status <> old.status and coalesce(old.status, '') <> 'freigegeben_intern' then
      raise exception 'Course must be internally approved before publishing';
    end if;
  elsif tg_op = 'INSERT' then
    if new.status = 'veroeffentlicht' then
      raise exception 'Course must be internally approved before publishing';
    end if;
  end if;

  -- Rejection should always include a note for the artist.
  if new.status = 'abgelehnt' and coalesce(btrim(new.admin_notes), '') = '' then
    raise exception 'admin_notes are required when rejecting a course';
  end if;

  return new;
end;
$$;
