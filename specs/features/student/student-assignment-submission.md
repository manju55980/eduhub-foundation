# Student assignment submission

Specifies how an enrolled student sees assignments, reads the instructions and due date, and submits once. Creating assignments stays in `instructor-assignment-management.md`. Browsing and enrollment stay in `student-browse-courses.md`. The enrolled-course list stays in `student-my-courses.md`. Grades and feedback are specified in `student-my-grades.md` and are not this feature. Grading stays on `/instructor/submissions`. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, or migration.

## Route

`/student/assignments` is Assignments. The heading is “Assignments”. It is a sidebar item, so it has no back link. The existing file route stays in place. Do not add an assignment-detail route. Each assignment is a card.

## Schema and RLS

No schema change and no RLS change. The applied rules already cover this screen:

| Need                                 | What already exists                                                                                                                                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| See assignments for enrolled courses | `assignments_select` returns a row to a student only when `is_enrolled(course_id)` is true. A published course the student has not joined is not returned. An archived course they already joined is returned, because enrollment still exists. |
| Read the instructions and due date   | `assignments.title`, `description`, and `due_date` are already selectable. `due_date` is nullable. Nothing in the schema blocks a submission after that time, so this screen does not add that rule.                                            |
| Submit text or a link                | `submissions.content_url` is text. The column comment says it is text or a link, not a storage object. There is no storage bucket.                                                                                                              |
| One submission per assignment        | `submissions_assignment_student_uidx` is unique on `assignment_id` and `student_id`.                                                                                                                                                            |
| Insert only their own submitted row  | `submissions_insert_student` allows a student insert only when `student_id` is the session user, `status` is `submitted`, `grade` and `feedback` are null, and `is_enrolled` is true for that assignment’s course.                              |
| No resubmission                      | There is no student update policy. The update grant is `grade`, `feedback`, and `status` only, so `content_url` cannot be changed. There is no delete grant. A second insert for the same student and assignment fails the unique index.        |

Do not add a `lesson_id`, a file column, a late-submission constraint, or a student update or delete policy.

## Listing

Read with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin and passes the session user id, as Browse Courses does. The query lives in `features/student/`. Do not use the service-role client.

List assignments the signed-in student can read. That is the assignments for courses they have joined, including an archived course. Do not list an assignment for a course they have not joined. Then read those courses’ stored `title`, and the student’s own `submissions` for those assignment ids.

Order assignments by `created_at` descending. Do not add search, filters, pagination, or another student’s submission.

If the assignment query, course query, or submission query fails, show that error and do not offer Submit. An empty assignment list is an empty state, not sample assignments. Link that empty state to `/student/courses`. The link label is “Browse Courses”.

If an assignment’s course row is not returned, omit that assignment. Do not invent a title or a card for it.

## Assignment details

Each card shows the stored assignment `title`, `description`, and `due_date`, the stored course `title`, and the assignment `created_at`. A null title, description, due date, or course title is shown blank. Do not substitute a made-up name or date. A student cannot read another person’s profile, so a card does not show an instructor name.

`description` is the instructions. `due_date` is only a displayed time. It does not hide Submit, and it does not change the insert.

Do not show `grade` or `feedback` here. Do not list lessons.

## Submit

An assignment with no submission from this student has one field and Submit. The field is the text or link stored in `content_url`. It is required. Trim it and reject blank. Do not check that it is a URL. Do not upload a file. A blank value is not stored as `""`.

The insert sends only:

| Column          | Value                              |
| --------------- | ---------------------------------- |
| `assignment_id` | The assignment on that card.       |
| `student_id`    | The signed-in user. Not collected. |
| `content_url`   | The trimmed text or link.          |
| `status`        | `submitted`. Not collected.        |
| `grade`         | null. Not collected.               |
| `feedback`      | null. Not collected.               |

Do not send `id` or `created_at`. Do not send a status other than `submitted`.

Submitting does not create an assignment, lesson, or enrollment, and it does not change the assignment or the course.

## Resubmission

A student can submit each assignment only once. If a submission row already exists for that student and assignment, the card does not offer Submit. It shows the stored `content_url` and the stored status, `submitted` or `graded`.

This screen does not update or delete a submission. Cancel is not a second submit. If the insert still fails, including a unique-index failure, show the database error and do not claim the assignment was submitted. Leave the entered text in place.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, white bordered cards, and the existing button, input, and textarea primitives.

- **Loading.** The list is not shown yet. Do not offer Submit and do not show sample assignments.
- **Ready.** The list shows the loaded assignments, or the empty state. An assignment with no submission has Submit. An assignment that already has one does not.
- **Submitting.** The Submit control that was used does not send a second insert.
- **Submitted.** Stay on this screen. That card shows the stored text and status and no longer offers Submit. The banner says “This assignment was submitted.” It can be dismissed. Dismissing it does not remove the submission or change the route.
- **Error.** Show the Supabase or form error inline. An error replaces the success banner. Leave the entered text in place.

No second visual system. No grade, feedback, lesson list, or other student’s submission on this screen.

## Authorization

The student layout already calls `requireRole("student")`. An instructor or admin is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- Creating or editing assignments. That stays in `instructor-assignment-management.md`.
- Grading. That stays in `../instructor/instructor-grading.md`. The student’s own grades are specified in `student-my-grades.md`.
- Changing a submission or submitting the same assignment again.
- File upload.
- Enrollment, lessons, and course status changes.
- Instructor and admin screens.

## Acceptance criteria

- A student sees assignments only for courses they have joined, newest assignment `created_at` first. A course they have not joined contributes no assignment. An archived course they already joined can contribute assignments.
- Each card shows the stored title, instructions, due date, course title, and assignment created time. A null value is blank. It does not show an instructor name, a lesson, a grade, or feedback.
- The due date does not block Submit.
- Submit inserts one row for the signed-in student and that assignment, with the trimmed text or link, status `submitted`, and null grade and feedback. It does not send `id` or `created_at`.
- A blank submission is rejected before the insert. The value is not stored as `""`. There is no URL check and no file upload.
- An assignment that already has this student’s submission shows that stored text and status and does not offer Submit.
- There is no edit, resubmit, or delete control. A failed insert shows the database error and leaves the text in place.
- The empty list has no sample assignments and no Submit control. It links to Browse Courses.
- A failed assignment, course, or submission load shows the error and does not offer Submit.
- An assignment whose course row is not returned has no card.
- No table, column, policy, or migration is added.
- An instructor or admin does not get this screen.
