-- Local until applied. Issues one certificate and two notifications
-- the first time an enrollment status becomes completed.
-- A later return to completed inserts nothing.
-- Does not replace the existing enrollment status trigger.
-- Does not send email and does not use the service role.

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index certificates_enrollment_id_uidx
  on public.certificates (enrollment_id);

create index certificates_student_id_idx
  on public.certificates (student_id);

create index certificates_course_id_idx
  on public.certificates (course_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (
    kind in ('course_completed', 'student_completed_course', 'assignment_due')
  ),
  course_id uuid references public.courses (id) on delete restrict,
  enrollment_id uuid references public.enrollments (id) on delete restrict,
  assignment_id uuid references public.assignments (id) on delete restrict,
  title text not null,
  body text not null,
  read_at timestamptz,
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe_key_uidx
  on public.notifications (dedupe_key);

create index notifications_recipient_id_idx
  on public.notifications (recipient_id);

alter table public.certificates enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.certificates from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select on table public.certificates to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

create policy certificates_select
  on public.certificates
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

create policy notifications_select
  on public.notifications
  for select
  to authenticated
  using (
    public.current_app_role() = 'admin'
    or recipient_id = (select auth.uid())
  );

create policy notifications_update_recipient
  on public.notifications
  for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function public.notifications_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is distinct from old.recipient_id then
    raise exception 'only the recipient can mark a notification read';
  end if;

  if new.id is distinct from old.id
    or new.recipient_id is distinct from old.recipient_id
    or new.kind is distinct from old.kind
    or new.course_id is distinct from old.course_id
    or new.enrollment_id is distinct from old.enrollment_id
    or new.assignment_id is distinct from old.assignment_id
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.dedupe_key is distinct from old.dedupe_key
    or new.created_at is distinct from old.created_at
  then
    raise exception 'a notification update can change only read_at';
  end if;

  if new.read_at is null or (old.read_at is not null and new.read_at is distinct from old.read_at) then
    raise exception 'read_at cannot be cleared';
  end if;

  return new;
end;
$$;

revoke all on function public.notifications_guard_update() from public, anon, authenticated;

create trigger notifications_guard_update
  before update on public.notifications
  for each row execute function public.notifications_guard_update();

create or replace function public.enrollments_issue_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  course_title text;
  course_instructor_id uuid;
begin
  select course.title, course.instructor_id
  into course_title, course_instructor_id
  from public.courses as course
  where course.id = new.course_id;

  insert into public.certificates (enrollment_id, student_id, course_id)
  values (new.id, new.student_id, new.course_id)
  on conflict (enrollment_id) do nothing;

  insert into public.notifications (
    recipient_id,
    kind,
    course_id,
    enrollment_id,
    title,
    body,
    dedupe_key
  )
  values (
    new.student_id,
    'course_completed',
    new.course_id,
    new.id,
    'Course complete',
    coalesce(course_title, ''),
    'course_completed:' || new.id::text
  )
  on conflict (dedupe_key) do nothing;

  if course_instructor_id is not null then
    insert into public.notifications (
      recipient_id,
      kind,
      course_id,
      enrollment_id,
      title,
      body,
      dedupe_key
    )
    values (
      course_instructor_id,
      'student_completed_course',
      new.course_id,
      new.id,
      'A student completed a course',
      coalesce(course_title, ''),
      'student_completed_course:' || new.id::text
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.enrollments_issue_certificate() from public, anon, authenticated;

-- AFTER UPDATE, not UPDATE OF status. sync_enrollment_progress writes progress only.
-- enrollments_sync_status assigns status in that same update, and UPDATE OF
-- does not see a column assigned by a BEFORE trigger.
create trigger enrollments_issue_certificate
  after update on public.enrollments
  for each row
  when (old.status is distinct from new.status and new.status = 'completed')
  execute function public.enrollments_issue_certificate();
