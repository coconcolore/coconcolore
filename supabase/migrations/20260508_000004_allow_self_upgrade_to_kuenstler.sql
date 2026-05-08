-- Allow authenticated users to upgrade themselves from role 'user' to 'kuenstler'.
-- This supports the self-registration -> artist onboarding flow.

create or replace function public.prevent_unprivileged_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if public.is_manager() then
      return new;
    end if;

    if auth.uid() = old.id and old.role = 'user' and new.role = 'kuenstler' then
      return new;
    end if;

    raise exception 'Only admin or kuenstler_manager can change roles';
  end if;

  return new;
end;
$$;
