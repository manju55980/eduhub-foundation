-- Local until applied. Do not run this against the remote project until that is asked for.
-- Runs after 20261010233000_create_categories.sql because the freeze replaces
-- courses_guard_update and that function still mentions category_id.
-- Does not change submission links or lesson video links.
-- Does not add a delete grant. Replacing a material is not specified.

create or replace function public.is_draft_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses
    where id = target_course_id
      and status = 'draft'
  );
$$;

create or replace function public.is_pending_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses
    where id = target_course_id
      and status = 'pending'
  );
$$;

create or replace function public.storage_course_id(object_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;

revoke all on function public.is_draft_course(uuid) from public, anon;
revoke all on function public.is_pending_course(uuid) from public, anon;
revoke all on function public.storage_course_id(text) from public, anon;
grant execute on function public.is_draft_course(uuid) to authenticated;
grant execute on function public.is_pending_course(uuid) to authenticated;
grant execute on function public.storage_course_id(text) to authenticated;

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
    if old.status <> 'draft'
      and (
        new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.level is distinct from old.level
        or new.category_id is distinct from old.category_id
      )
    then
      raise exception 'instructors can change course fields only while the course is a draft';
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

drop policy if exists lessons_insert_instructor on public.lessons;
drop policy if exists lessons_update_instructor on public.lessons;
drop policy if exists assignments_write_instructor on public.assignments;
drop policy if exists assignments_update_instructor on public.assignments;

create policy lessons_insert_instructor
  on public.lessons
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
    and public.is_draft_course(course_id)
  );

create policy lessons_update_instructor
  on public.lessons
  for update
  to authenticated
  using (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
    and public.is_draft_course(course_id)
  )
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
    and public.is_draft_course(course_id)
  );

create policy assignments_write_instructor
  on public.assignments
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
    and public.is_draft_course(course_id)
  );

create policy assignments_update_instructor
  on public.assignments
  for update
  to authenticated
  using (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
    and public.is_draft_course(course_id)
  )
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
    and public.is_draft_course(course_id)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/png',
    'image/jpeg'
  ]
);

create policy course_materials_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'course-materials'
    and (
      public.current_app_role() = 'admin'
      or (
        public.current_app_role() = 'instructor'
        and public.is_course_owner(public.storage_course_id(name))
      )
      or (
        public.current_app_role() = 'student'
        and public.is_enrolled(public.storage_course_id(name))
      )
    )
  );

create policy course_materials_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'course-materials'
    and public.current_app_role() = 'instructor'
    and public.is_course_owner(public.storage_course_id(name))
    and public.is_draft_course(public.storage_course_id(name))
  );

create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  file_name text not null,
  mime_type text not null,
  byte_size integer not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint course_materials_file_name_safe check (
    file_name = btrim(file_name)
    and file_name <> ''
    and file_name <> '.'
    and file_name <> '..'
    and position('/' in file_name) = 0
    and strpos(file_name, chr(92)) = 0
  ),
  constraint course_materials_mime_type check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/png',
      'image/jpeg'
    )
  ),
  constraint course_materials_byte_size check (byte_size >= 1 and byte_size <= 20971520),
  constraint course_materials_extension_matches check (
    (
      mime_type = 'application/pdf'
      and lower(right(file_name, 4)) = '.pdf'
    )
    or (
      mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      and lower(right(file_name, 5)) = '.docx'
    )
    or (
      mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      and lower(right(file_name, 5)) = '.pptx'
    )
    or (
      mime_type = 'text/plain'
      and lower(right(file_name, 4)) = '.txt'
    )
    or (
      mime_type = 'image/png'
      and lower(right(file_name, 4)) = '.png'
    )
    or (
      mime_type = 'image/jpeg'
      and (
        lower(right(file_name, 4)) = '.jpg'
        or lower(right(file_name, 5)) = '.jpeg'
      )
    )
  )
);

create unique index course_materials_storage_path_uidx
  on public.course_materials (storage_path);

create index course_materials_course_created_idx
  on public.course_materials (course_id, created_at desc);

create or replace function public.course_materials_set_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is null then
    new.id := pg_catalog.gen_random_uuid();
  end if;
  new.storage_path := new.course_id::text || '/' || new.id::text || '/' || new.file_name;
  return new;
end;
$$;

revoke all on function public.course_materials_set_path() from public, anon, authenticated;

create trigger course_materials_set_path
  before insert on public.course_materials
  for each row execute function public.course_materials_set_path();

alter table public.course_materials enable row level security;

revoke all on table public.course_materials from anon, authenticated;

grant select on table public.course_materials to authenticated;
grant insert (course_id, file_name, mime_type, byte_size)
  on table public.course_materials to authenticated;

create policy course_materials_select
  on public.course_materials
  for select
  to authenticated
  using (
    public.current_app_role() = 'admin'
    or (
      public.current_app_role() = 'instructor'
      and public.is_course_owner(course_id)
    )
    or (
      public.current_app_role() = 'student'
      and public.is_enrolled(course_id)
    )
  );

create policy course_materials_insert_instructor
  on public.course_materials
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
    and public.is_draft_course(course_id)
  );

create table public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  recommendation text not null,
  confidence numeric not null,
  summary text not null,
  findings text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint course_reviews_recommendation check (recommendation in ('recommend', 'revise')),
  constraint course_reviews_confidence check (confidence >= 0 and confidence <= 1)
);

alter table public.course_reviews enable row level security;

revoke all on table public.course_reviews from anon, authenticated;

grant select on table public.course_reviews to authenticated;
grant insert (course_id, recommendation, confidence, summary, findings)
  on table public.course_reviews to authenticated;

create policy course_reviews_select_admin
  on public.course_reviews
  for select
  to authenticated
  using (public.current_app_role() = 'admin');

create policy course_reviews_insert_admin
  on public.course_reviews
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'admin'
    and public.is_pending_course(course_id)
  );
