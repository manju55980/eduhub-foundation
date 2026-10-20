-- Local until applied. Records one completion per student and lesson.
-- Progress is derived by sync_enrollment_progress. Students do not update enrollments.
-- Does not change existing enrollment policies or the status trigger.
-- Does not issue certificates or notifications. Does not use the service role.

create table public.lesson_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  lesson_id uuid not null references public.lessons (id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index lesson_completions_student_lesson_uidx
  on public.lesson_completions (student_id, lesson_id);

create index lesson_completions_lesson_id_idx
  on public.lesson_completions (lesson_id);

alter table public.lesson_completions enable row level security;

revoke all on table public.lesson_completions from anon, authenticated;

grant select on table public.lesson_completions to authenticated;
grant insert (student_id, lesson_id) on table public.lesson_completions to authenticated;

create or replace function public.lesson_course_id(target_lesson_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select course_id
  from public.lessons
  where id = target_lesson_id;
$$;

revoke all on function public.lesson_course_id(uuid) from public, anon;
grant execute on function public.lesson_course_id(uuid) to authenticated;

create policy lesson_completions_select
  on public.lesson_completions
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
      and public.is_course_owner(public.lesson_course_id(lesson_id))
    )
  );

create policy lesson_completions_insert_student
  on public.lesson_completions
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'student'
    and student_id = (select auth.uid())
    and public.is_enrolled(public.lesson_course_id(lesson_id))
  );

create or replace function public.sync_enrollment_progress(
  p_student_id uuid,
  p_course_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_count integer;
  completed_count integer;
  next_progress integer;
begin
  select count(*)::integer
  into lesson_count
  from public.lessons
  where course_id = p_course_id;

  if lesson_count = 0 then
    next_progress := 0;
  else
    select count(*)::integer
    into completed_count
    from public.lesson_completions as completion
    where completion.student_id = p_student_id
      and exists (
        select 1
        from public.lessons as lesson
        where lesson.id = completion.lesson_id
          and lesson.course_id = p_course_id
      );

    next_progress := least(
      100,
      floor(completed_count * 100.0 / lesson_count)::integer
    );
  end if;

  update public.enrollments
  set progress = next_progress
  where student_id = p_student_id
    and course_id = p_course_id
    and progress is distinct from next_progress;
end;
$$;

revoke all on function public.sync_enrollment_progress(uuid, uuid) from public, anon, authenticated;

create or replace function public.lesson_completions_sync_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_course_id uuid;
begin
  target_course_id := public.lesson_course_id(new.lesson_id);
  if target_course_id is not null then
    perform public.sync_enrollment_progress(new.student_id, target_course_id);
  end if;
  return new;
end;
$$;

revoke all on function public.lesson_completions_sync_progress() from public, anon, authenticated;

create trigger lesson_completions_sync_progress
  after insert on public.lesson_completions
  for each row execute function public.lesson_completions_sync_progress();

create or replace function public.lessons_sync_enrollment_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment record;
begin
  for enrollment in
    select student_id
    from public.enrollments
    where course_id = new.course_id
  loop
    perform public.sync_enrollment_progress(enrollment.student_id, new.course_id);
  end loop;
  return new;
end;
$$;

revoke all on function public.lessons_sync_enrollment_progress() from public, anon, authenticated;

create trigger lessons_sync_enrollment_progress
  after insert on public.lessons
  for each row execute function public.lessons_sync_enrollment_progress();
