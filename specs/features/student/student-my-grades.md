# Student My Grades

Specifies how a student reads their own graded submissions. Submitting stays in `student-assignment-submission.md`. Grading stays in `../instructor/instructor-grading.md`. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, route, or migration.

## Route

`/student/grades` is My Grades. The heading is “My Grades”. It is a sidebar item, so it has no back link. The existing file route stays in place. Do not add a grade-detail route. Each graded submission is a card.

A submission that is still `submitted` stays on `/student/assignments`. It is not listed here, and this screen does not grade it.

## Schema and RLS

No schema change and no RLS change. The applied rules already cover this screen:

| Need                            | What already exists                                                                                                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read only their own submissions | `submissions_select` returns a row to a student only when `student_id` is the session user. Another student’s grade or feedback is not returned. An admin can read every submission, but this screen is student-only. |
| Read the grade and feedback     | `grade` and `feedback` are selectable. `grade` is text holding the whole number from 1 to 10 saved by the instructor. `feedback` is nullable.                                                                                          |
| Know which rows are graded      | `status` is `submitted` or `graded`. This screen lists `graded` only.                                                                                                                                                 |
| Read the assignment             | `assignments_select` returns a row to a student only when `is_enrolled(course_id)` is true. `title`, `description`, and `due_date` are selectable. `due_date` is nullable.                                            |
| Read the course title           | `courses_select` returns a course to a student when it is `published` or when `is_enrolled` is true. An archived course they already joined is returned.                                                              |
| No write                        | There is no student update policy. The update grant is `grade`, `feedback`, and `status` only, and only `submissions_update_instructor` allows that update. There is no delete grant.                                 |

A student cannot read another person’s profile, so this screen does not request `profiles`. Do not add a grade scale, a `graded_at` column, or a student update or delete policy.

## Listing

Read with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin and passes the session user id, as Assignments does. The query lives in `features/student/`. Do not use the service-role client.

List this student’s submissions whose `status` is `graded`. Then read each submission’s assignment `title`, `description`, and `due_date`, and that assignment’s course `title`.

Order by the submission `created_at` descending. Do not add search, filters, pagination, or another student’s submission. Do not add a second view for ungraded work.

If the submission query, assignment query, or course query fails, show that error and do not show cards. An empty graded list is an empty state, not sample grades. Link that empty state to `/student/assignments`. The link label is “Assignments”.

The grade is the row this screen exists to show. A graded submission is still shown when its assignment or course row is not returned. A missing or null title, description, due date, or course title is blank. Do not invent one, and do not drop the grade.

## Grade details

Each card shows the stored assignment `title`, `description`, and `due_date`, the stored course `title`, the stored `content_url`, `grade`, `feedback`, submission `status`, and submission `created_at`. A null value is shown blank.

`description` is the instructions. `due_date` is only a displayed time. `content_url` is the text or link this student submitted. `grade` and `feedback` are read-only. Status is shown as Graded. A card does not show an instructor name, a lesson, enrollment progress, or another student’s submission.

## Actions

This screen does not insert, update, or delete a submission, assignment, course, or enrollment. There is no Save, edit, resubmit, or delete control. There is no success banner, because this screen does not write.

## UI

Follow the visual direction in `product.md`. Use `PageHeader` and white bordered cards. Do not add a form.

- **Loading.** The list is not shown yet. Do not show sample grades.
- **Ready.** The list shows the loaded graded submissions, or the empty state.
- **Error.** Show the Supabase error inline. Do not show cards and do not show sample grades.

No second visual system. No grade input, feedback input, file upload, or grading scale on this screen.

## Authorization

The student layout already calls `requireRole("student")`. An instructor or admin is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- Submitting or changing `content_url`. That stays in `student-assignment-submission.md`.
- Grading. That stays in `../instructor/instructor-grading.md`.
- Listing a `submitted` row that has no grade yet.
- Enrollment, lessons, and course status changes.
- Instructor and admin screens, including an admin grade list.
- Categories, dashboards, reports, and the animated progress tracker.

## Acceptance criteria

- A student sees only their own submissions whose `status` is `graded`, newest submission `created_at` first. A `submitted` row is not listed. Another student’s grade is not listed.
- Each card shows the stored assignment title, instructions, due date, course title, submitted text or link, grade, feedback, status Graded, and submission created time. A null or missing related value is blank. It does not show an instructor name, a lesson, or enrollment progress.
- A graded submission whose assignment or course row is missing still has a card.
- An archived course the student joined can supply the course title. The due date does not hide the grade.
- The screen does not write. It has no save, edit, resubmit, or delete control, and no success banner.
- The empty list has no sample grades. It links to Assignments.
- A failed submission, assignment, or course load shows the error and does not show cards.
- No table, column, policy, or migration is added.
- An instructor or admin does not get this screen.
