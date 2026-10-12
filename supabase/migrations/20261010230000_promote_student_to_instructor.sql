-- Local until applied. Lets a signed-in admin promote a different student
-- to instructor. No new table or column. Does not grant update on role.
-- Does not use the service role.

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Manual first-admin setup has no user JWT.
  if auth.uid() is null then
    return new;
  end if;

  if public.current_app_role() = 'admin'
    and old.id is distinct from (select auth.uid())
    and old.role = 'student'
    and new.role = 'instructor'
    and new.id is not distinct from old.id
    and new.full_name is not distinct from old.full_name
    and new.email is not distinct from old.email
    and new.phone is not distinct from old.phone
    and new.created_at is not distinct from old.created_at
  then
    return new;
  end if;

  raise exception 'profile role cannot be changed from a signed-in session';
end;
$$;

revoke all on function public.prevent_profile_role_change() from public, anon, authenticated;

create or replace function public.promote_student_to_instructor(target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'only an admin can promote a student';
  end if;

  if target_id is not distinct from (select auth.uid()) then
    raise exception 'an admin cannot change their own role';
  end if;

  update public.profiles
  set role = 'instructor'
  where id = target_id
    and role = 'student';

  if found then
    return;
  end if;

  if exists (
    select 1
    from public.profiles
    where id = target_id
      and role = 'instructor'
  ) then
    raise exception 'this user is already an instructor';
  end if;

  raise exception 'only a student can be promoted to instructor';
end;
$$;

revoke all on function public.promote_student_to_instructor(uuid) from public, anon;
grant execute on function public.promote_student_to_instructor(uuid) to authenticated;
