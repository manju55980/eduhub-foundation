# Instructor assignment management

Specifies how an instructor creates, edits, and lists assignments for a course they own. Course creation stays in `instructor-course-creation.md`. Lessons stay in `instructor-my-courses.md`. Grading stays on `/instructor/submissions` and is not this feature. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, or migration.

## Route

| Path                                        | What it is                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `/instructor/courses/$courseId/assignments` | Assignments for one course the instructor owns. No separate sidebar item. |

The instructor sidebar stays as recorded in `product.md`. Do not add an Assignments item. `/instructor/submissions` stays the grading screen and does not create or edit assignments.

Each course card on `/instructor/courses` links here. The link label is “Assignments”. It is shown for every course status, next to the existing Lessons link. The course list still does not show assignment rows, counts, grades, or submissions.

The heading is the course title when one is stored, otherwise “Assignments”. The back link goes to `/instructor/courses` and its label is “My Courses (including lessons)”.

## Schema and RLS

No schema change. `assignments` already has `course_id`. That is the course association. The table has no `lesson_id`, and this feature does not add one. An assignment is for the course, not for one lesson. Lessons stay on `/instructor/courses/$courseId/lessons`. Creating or editing an assignment does not create, edit, delete, or reorder a lesson.

No RLS change. The applied policies already do this:

| Action | Rule                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------- |
| Select | An admin, the owning instructor (`is_course_owner(course_id)`), or a student enrolled in that course. |
| Insert | An instructor, and only when `is_course_owner(course_id)` is true.                                    |
| Update | The owning instructor. The update grant is `title`, `description`, and `due_date` only.               |
| Delete | No grant. `assignments` are referenced by `submissions` with `ON DELETE RESTRICT`.                    |

`course_id` is not in the update grant, so an edit cannot move an assignment to another course. Do not send `course_id` on edit. Policies do not check course status. Do not add a client-side status gate. An instructor can manage assignments on a `draft`, `pending`, `published`, or `archived` course they own.

`title`, `description`, and `due_date` are nullable in the table. Do not add a database constraint for them.

## Listing

Load the course with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The query lives in `features/instructor/`. Do not use the service-role client.

If the course row is not returned, show that it is not available. Do not list assignments and do not show the form.

Otherwise list that course’s assignments. `assignments_select` already limits an instructor to courses they own. Still request `course_id` equal to the route id. Order by `created_at` descending. Do not add search, filters, pagination, `order_index`, submission counts, or grades.

Show each assignment’s stored `title`, `description`, `due_date`, and `created_at`. A null `title`, `description`, or `due_date` is shown blank. Do not substitute a made-up title or date. An empty list is an empty state, not sample assignments.

If the course query or the assignment query fails, show that error and do not offer save.

## Create and edit

The page can create an assignment and edit an existing one. Both stay on this page. A create saves one row and then clears the form so the same assignment is not inserted twice. An edit leaves the saved values in place. Cancel closes the edit and does not write. Neither save changes the course, its lessons, or any submission.

| Column             | On create                                                                   | On edit                        |
| ------------------ | --------------------------------------------------------------------------- | ------------------------------ |
| `title`            | Required. Trimmed text. Reject blank.                                       | Same.                          |
| `description`      | Required. Trimmed text. Reject blank.                                       | Same.                          |
| `due_date`         | Optional. A blank value stores null. No rule that it must be in the future. | Same. Clearing it stores null. |
| `course_id`        | The route id. Not collected.                                                | Not sent.                      |
| `id`, `created_at` | Not collected.                                                              | Not sent.                      |

Do not store `""` for `title`, `description`, or `due_date`. Do not add a character limit. The table does not make `title` unique, and this screen does not reject a duplicate. Do not add that constraint.

AI Course Builder inserts generated assignments with a due date before the course is submitted. This screen is where the instructor reviews and changes that date. An edit writes `title`, `description`, and `due_date` through the existing update grant. It stores the value in the form, including a cleared null. It does not fill a new lesson-order default over a date already saved.

There is no delete control.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, white bordered cards, and the existing button, input, and textarea primitives.

- **Loading.** The course and its assignments are not shown yet. Do not offer save and do not show sample assignments.
- **Missing course.** Say the course is not available. No form and no assignment list.
- **Ready.** The list shows the loaded assignments, or the empty state. The create form is shown only when the course was returned.
- **Submitting.** The control that was used does not send a second request.
- **Saved.** Stay on this screen. The banner says “This assignment was saved.” or “This assignment was updated.” It can be dismissed. Dismissing it does not undo the save or change the route.
- **Error.** Show the Supabase or form error inline. An error replaces the success banner. Leave the entered values in place.

No second visual system. No enrollment, grade, submission, or lesson list on this screen.

## Authorization

The instructor layout already calls `requireRole("instructor")`. A student or admin is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- Student assignment listing and submission. Those are specified in `../student/student-assignment-submission.md`.
- Instructor grading, feedback, and submission status. Those are specified in `instructor-grading.md`.
- Attaching an assignment to one lesson, including a `lesson_id` column.
- Deleting or moving an assignment.
- Course and lesson editing, course status changes, and enrollment progress.
- Admin, category, dashboard, and report screens.

## Acceptance criteria

- An instructor opens assignments from one of their own courses. Another instructor’s course shows no form and inserts nothing.
- The list is that course’s assignments, newest `created_at` first. It does not list another course’s assignments.
- A new assignment requires a trimmed title and trimmed description, stores a blank due date as null, and sets `course_id` from the route. It does not send `id` or `created_at`.
- An edit sends only `title`, `description`, and `due_date`. It does not change `course_id`, `id`, or `created_at`, and it does not move the assignment to a lesson or another course.
- The empty list has no sample assignments. A failed course or assignment load shows the error and does not offer save.
- There is no delete control. Saving does not create a lesson, enrollment, or submission, and does not grade anything.
- The screen does not add a sidebar item. Grading stays on `/instructor/submissions`.
- No table, column, policy, or migration is added.
- A student or admin does not get this screen.
