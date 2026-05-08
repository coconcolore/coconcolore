-- Restore strict role-change guard:
-- only admin or kuenstler_manager may change user roles.

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
