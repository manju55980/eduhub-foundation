-- Local until applied. One row is one class meeting.
-- Instructors keep the meeting time after a course leaves draft.
-- Students read meetings only for courses they have joined.
-- Admins have no policy. Delete is not granted.

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  created_at timestamptz not null default now(),
  constraint class_sessions_title_not_blank check (char_length(btrim(title)) > 0),
  constraint class_sessions_ends_after_start check (ends_at > starts_at)
);

comment on table public.class_sessions is
  'One meeting for a course. Assignment deadlines stay on assignments.due_date.';

create index class_sessions_course_id_idx on public.class_sessions (course_id);
create index class_sessions_starts_at_idx on public.class_sessions (starts_at);

alter table public.class_sessions enable row level security;

revoke all on table public.class_sessions from anon, authenticated;

grant select, insert on table public.class_sessions to authenticated;
grant update (title, starts_at, ends_at, location) on table public.class_sessions to authenticated;

create policy class_sessions_select
  on public.class_sessions
  for select
  to authenticated
  using (
    (
      private.current_app_role() = 'instructor'
      and private.is_course_owner(course_id)
    )
    or (
      private.current_app_role() = 'student'
      and private.is_enrolled(course_id)
    )
  );

create policy class_sessions_insert_instructor
  on public.class_sessions
  for insert
  to authenticated
  with check (
    private.current_app_role() = 'instructor'
    and private.is_course_owner(course_id)
  );

create policy class_sessions_update_instructor
  on public.class_sessions
  for update
  to authenticated
  using (
    private.current_app_role() = 'instructor'
    and private.is_course_owner(course_id)
  )
  with check (
    private.current_app_role() = 'instructor'
    and private.is_course_owner(course_id)
  );
