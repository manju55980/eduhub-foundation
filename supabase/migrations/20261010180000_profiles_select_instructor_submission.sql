-- Local until applied. Lets an instructor read the name of a student who
-- submitted work for a course that instructor owns. No new column.

create policy profiles_select_instructor_submission
  on public.profiles
  for select
  to authenticated
  using (
    public.current_app_role() = 'instructor'
    and exists (
      select 1
      from public.submissions as submission
      join public.assignments as assignment
        on assignment.id = submission.assignment_id
      where submission.student_id = public.profiles.id
        and public.is_course_owner(assignment.course_id)
    )
  );
