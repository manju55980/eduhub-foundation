-- LMS tables. Not applied to the remote project.
-- Does not change the profiles auth migration.
-- No categories table, no grade scale, and no file-storage bucket.
-- Hard deletes are not granted. Archive a published course instead.
-- Cross-table checks are security-definer functions so policies do not recurse.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid());
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles (id) on delete restrict,
  title text,
  description text,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  status text not null default 'draft' check (status in ('draft', 'pending', 'published', 'archived')),
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text,
  content text,
  video_url text,
  order_index integer,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text,
  description text,
  due_date timestamptz,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  content_url text,
  grade text,
  feedback text,
  status text not null check (status in ('submitted', 'graded')),
  created_at timestamptz not null default now()
);

comment on column public.enrollments.progress is
  'Percentage from 0 to 100. Status becomes completed at 100.';
comment on column public.submissions.grade is
  'Plain text. No grading scale is defined.';
comment on column public.submissions.content_url is
  'Text or link submitted by the student. Not a storage object.';

create index courses_instructor_id_idx on public.courses (instructor_id);
create index courses_status_idx on public.courses (status);
create index lessons_course_id_idx on public.lessons (course_id);
create index lessons_course_order_idx on public.lessons (course_id, order_index);
create index enrollments_course_id_idx on public.enrollments (course_id);
create unique index enrollments_student_course_uidx on public.enrollments (student_id, course_id);
create index assignments_course_id_idx on public.assignments (course_id);
create index submissions_student_id_idx on public.submissions (student_id);
create unique index submissions_assignment_student_uidx on public.submissions (assignment_id, student_id);

alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

revoke all on table public.courses from anon, authenticated;
revoke all on table public.lessons from anon, authenticated;
revoke all on table public.enrollments from anon, authenticated;
revoke all on table public.assignments from anon, authenticated;
revoke all on table public.submissions from anon, authenticated;

grant select, insert on table public.courses to authenticated;
grant update (title, description, level, status) on table public.courses to authenticated;
grant select, insert on table public.lessons to authenticated;
grant update (title, content, video_url, order_index) on table public.lessons to authenticated;
grant select, insert on table public.enrollments to authenticated;
grant update (progress) on table public.enrollments to authenticated;
grant select, insert on table public.assignments to authenticated;
grant update (title, description, due_date) on table public.assignments to authenticated;
grant select, insert on table public.submissions to authenticated;
grant update (grade, feedback, status) on table public.submissions to authenticated;

create or replace function public.is_course_owner(target_course_id uuid)
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
      and instructor_id = (select auth.uid())
  );
$$;

create or replace function public.is_enrolled(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments
    where course_id = target_course_id
      and student_id = (select auth.uid())
  );
$$;

create or replace function public.is_published_course(target_course_id uuid)
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
      and status = 'published'
  );
$$;

revoke all on function public.is_course_owner(uuid) from public, anon;
revoke all on function public.is_enrolled(uuid) from public, anon;
revoke all on function public.is_published_course(uuid) from public, anon;
grant execute on function public.is_course_owner(uuid) to authenticated;
grant execute on function public.is_enrolled(uuid) to authenticated;
grant execute on function public.is_published_course(uuid) to authenticated;

-- Admins can read every profile so they can manage users.
-- Role changes from a signed-in session stay blocked by the profiles trigger.
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.current_app_role() = 'admin');

create policy courses_select
  on public.courses
  for select
  to authenticated
  using (
    public.current_app_role() = 'admin'
    or (
      public.current_app_role() = 'instructor'
      and instructor_id = (select auth.uid())
    )
    or (
      public.current_app_role() = 'student'
      and (
        status = 'published'
        or public.is_enrolled(id)
      )
    )
  );

create policy courses_insert_instructor
  on public.courses
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'instructor'
    and instructor_id = (select auth.uid())
    and status = 'draft'
  );

create policy courses_update_instructor
  on public.courses
  for update
  to authenticated
  using (
    public.current_app_role() = 'instructor'
    and instructor_id = (select auth.uid())
  )
  with check (
    public.current_app_role() = 'instructor'
    and instructor_id = (select auth.uid())
  );

create policy courses_update_admin
  on public.courses
  for update
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

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

create trigger courses_guard_update
  before update on public.courses
  for each row execute function public.courses_guard_update();

create policy lessons_select
  on public.lessons
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

create policy lessons_insert_instructor
  on public.lessons
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
  );

create policy lessons_update_instructor
  on public.lessons
  for update
  to authenticated
  using (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
  )
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
  );

create policy enrollments_select
  on public.enrollments
  for select
  to authenticated
  using (
    public.current_app_role() = 'admin'
    or (
      public.current_app_role() = 'student'
      and student_id = (select auth.uid())
    )
    or (
      public.current_app_role() = 'instructor'
      and public.is_course_owner(course_id)
    )
  );

create policy enrollments_insert_student
  on public.enrollments
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'student'
    and student_id = (select auth.uid())
    and progress = 0
    and public.is_published_course(course_id)
  );

create or replace function public.enrollments_sync_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.progress = 100 then
    new.status := 'completed';
  else
    new.status := 'active';
  end if;
  return new;
end;
$$;

revoke all on function public.enrollments_sync_status() from public, anon, authenticated;

create trigger enrollments_sync_status
  before insert or update on public.enrollments
  for each row execute function public.enrollments_sync_status();

create policy enrollments_update_instructor
  on public.enrollments
  for update
  to authenticated
  using (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
  )
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
  );

create policy assignments_select
  on public.assignments
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

create policy assignments_write_instructor
  on public.assignments
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
  );

create policy assignments_update_instructor
  on public.assignments
  for update
  to authenticated
  using (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
  )
  with check (
    public.current_app_role() = 'instructor'
    and public.is_course_owner(course_id)
  );

create policy submissions_select
  on public.submissions
  for select
  to authenticated
  using (
    public.current_app_role() = 'admin'
    or (
      public.current_app_role() = 'student'
      and student_id = (select auth.uid())
    )
    or (
      public.current_app_role() = 'instructor'
      and exists (
        select 1
        from public.assignments as assignment
        where assignment.id = submissions.assignment_id
          and public.is_course_owner(assignment.course_id)
      )
    )
  );

create policy submissions_insert_student
  on public.submissions
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'student'
    and student_id = (select auth.uid())
    and status = 'submitted'
    and grade is null
    and feedback is null
    and exists (
      select 1
      from public.assignments as assignment
      where assignment.id = assignment_id
        and public.is_enrolled(assignment.course_id)
    )
  );

create policy submissions_update_instructor
  on public.submissions
  for update
  to authenticated
  using (
    public.current_app_role() = 'instructor'
    and exists (
      select 1
      from public.assignments as assignment
      where assignment.id = submissions.assignment_id
        and public.is_course_owner(assignment.course_id)
    )
  )
  with check (
    public.current_app_role() = 'instructor'
    and exists (
      select 1
      from public.assignments as assignment
      where assignment.id = assignment_id
        and public.is_course_owner(assignment.course_id)
    )
  );
