-- Local until applied. Adds categories and an optional course category.
-- An unused category is the only hard delete. A referenced category stays.
-- Does not change approval, enrollment, or other course-status rules.
-- Does not use the service role.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint categories_name_trimmed check (name = btrim(name) and name <> '')
);

create unique index categories_name_uidx on public.categories (name);

alter table public.courses
  add column category_id uuid references public.categories (id) on delete restrict;

create index courses_category_id_idx on public.courses (category_id);

alter table public.categories enable row level security;

revoke all on table public.categories from anon, authenticated;

grant select on table public.categories to authenticated;
grant insert (name) on table public.categories to authenticated;
grant update (name) on table public.categories to authenticated;
grant delete on table public.categories to authenticated;

grant update (category_id) on table public.courses to authenticated;

create policy categories_select
  on public.categories
  for select
  to authenticated
  using (true);

create policy categories_insert_admin
  on public.categories
  for insert
  to authenticated
  with check (public.current_app_role() = 'admin');

create policy categories_update_admin
  on public.categories
  for update
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy categories_delete_admin
  on public.categories
  for delete
  to authenticated
  using (public.current_app_role() = 'admin');

create or replace function public.courses_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  actor_role := public.current_app_role();

  if actor_role = 'admin' then
    if new.id is distinct from old.id
      or new.instructor_id is distinct from old.instructor_id
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.level is distinct from old.level
      or new.category_id is distinct from old.category_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'admins can change only course status';
    end if;
    if new.status is distinct from old.status
      and not (
        (old.status = 'pending' and new.status = 'published')
        or (old.status = 'published' and new.status = 'archived')
      )
    then
      raise exception 'admins can publish a pending course or archive a published course';
    end if;
    return new;
  end if;

  if actor_role = 'instructor' and old.instructor_id = (select auth.uid()) then
    if new.id is distinct from old.id
      or new.instructor_id is distinct from old.instructor_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'instructors cannot change course owner';
    end if;
    if new.status is distinct from old.status
      and not (old.status = 'draft' and new.status = 'pending')
    then
      raise exception 'instructors can only submit a draft course for approval';
    end if;
    return new;
  end if;

  raise exception 'course update is not allowed';
end;
$$;

revoke all on function public.courses_guard_update() from public, anon, authenticated;
