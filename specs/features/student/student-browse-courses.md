# Student browse courses

Specifies the published-course catalogue, enrollment, and the learning view for a course the student has joined. The My Courses list, assignments, and grades are separate screens. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, route, or migration.

## Routes

| Path                            | What it is                                                     |
| ------------------------------- | -------------------------------------------------------------- |
| `/student/courses`              | Browse Courses. Sidebar label: “Browse Courses”. No back link. |
| `/student/my-courses/$courseId` | Learning view for one course. No separate sidebar item.        |

The catalogue card shows the stored course fields. Its status label is Published. When this student’s enrollment for that course is `completed`, the label is Completed instead. An enrollment that is still `active` keeps Published. The stored course status is not changed.

A student cannot read another person’s profile, so a card does not show an instructor name. The catalogue does not list lessons. Lessons stay hidden until the student is enrolled.

## Catalogue

A signed-in student sees published courses. `courses_select` also returns a course the student is already enrolled in, including an archived one. This screen still requests only `status = published`. Archived, pending, and draft courses are not part of the catalogue.

Read courses and the student’s own enrollments with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The query lives in `features/student/`. Do not use the service-role client.

Order courses by `created_at` descending. A category filter is specified in `../admin/admin-manage-categories.md`. Do not add text search, other filters, pagination, or a count of other students.

If the course query or the enrollment query fails, show that error and do not offer Enroll or Open course. An empty catalogue is an empty state, not sample courses.

A course the student has not joined has Enroll and does not have Open course. A course the student has already joined has Open course and does not have Enroll. Open course goes to `/student/my-courses/$courseId`.

## Enrollment

The student enrolls once, in a published course. The insert sends only:

| Column       | Value                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------ |
| `student_id` | The signed-in user. Not collected on the card.                                             |
| `course_id`  | The published course on that card.                                                         |
| `progress`   | `0`. Not collected.                                                                        |
| `status`     | `active`. Not collected. `enrollments_sync_status` sets `active` when progress is not 100. |

Do not send `id` or `created_at`. Do not send a progress other than `0` or a status other than `active`.

`enrollments_insert_student` allows the insert only for a student, with `student_id` equal to the session user, `progress` 0, and `is_published_course(course_id)`. There is no delete grant and no unenroll control.

The unique index `enrollments_student_course_uidx` allows one row per student and course. If the student already has an enrollment for that course, the card does not offer Enroll. If the insert still fails, show the database error and do not claim the student enrolled.

Enroll does not create a lesson, assignment, or submission, and it does not change the course.

## Learning view

`/student/my-courses/$courseId` loads that course with the signed-in client. The heading is the course title when one is stored, otherwise “Lessons”. The back link goes to `/student/courses` and its label is “Browse Courses”.

If the course row is not returned, show that it is not available. Do not list lessons.

`lessons_select` returns a lesson to a student only when `is_enrolled(course_id)` is true. This screen checks the student’s own enrollment before it reads lessons.

- **Not enrolled.** Do not read or show lessons, including when the course is published. Do not offer Enroll here. Enrollment stays on Browse Courses.
- **Enrolled.** List that course’s lessons with no sample rows. Order by `order_index` ascending, nulls last, then `created_at` ascending. Show each lesson’s stored `title` and `content`. A null title or content is shown blank. Show `video_url` only when the stored value is an absolute `http` or `https` URL, as a plain-text link that opens in a new tab. A blank or other value is omitted. An enrolled course with no lessons is an empty lesson list, not sample lessons.

The learning view does not create, edit, delete, or reorder lessons, and it does not change course status. Students who already enrolled can open an archived course here, because `courses_select` still returns it and lesson select still allows an enrolled student. The catalogue does not list that archived course. Marking a lesson complete is specified in `student-lesson-completion.md`. This screen does not write `enrollments.progress` itself.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, white bordered cards, and the existing button primitives.

- **Ready.** The catalogue shows the loaded published courses, or the empty state. A course the student has not joined has Enroll. A course the student has joined has Open course. The learning view shows the enrolled course’s lessons, or an empty lesson list.
- **Submitting.** The Enroll control that was used does not send a second insert.
- **Enrolled.** Stay on Browse Courses. That card offers Open course and no longer offers Enroll. The banner says “You are enrolled in this course.” It can be dismissed. Dismissing it does not remove the enrollment or change the route.
- **Error.** Show the Supabase error inline. An error replaces the success banner. Leave the card unenrolled when the insert fails. A failed lesson load shows the error and does not show sample lessons.

No second visual system. No assignment, grade, or other student’s enrollment on these screens.

## Authorization

The student layout already calls `requireRole("student")`. An instructor or admin is redirected before these screens mount. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- The My Courses list. It is specified in `student-my-courses.md`.
- Assignments and grades.
- Unenroll, a direct progress edit, and course publishing or archiving. Marking a lesson complete is specified in `student-lesson-completion.md`.
- Creating or editing lessons. The study companion on the learning view is specified in `student-ai-study-companion.md`. It does not write lessons, assignments, or submissions.
- Instructor and admin screens.
- Creating or editing categories. The catalogue filter is specified in `../admin/admin-manage-categories.md`.
- Dashboards and reports.

## Acceptance criteria

- A student sees published courses, newest `created_at` first. Draft, pending, and archived courses are not listed on the catalogue.
- Each catalogue card shows the stored title, description, level, category name, and created time. A course with no category has a blank category name. It does not show an instructor name or lessons. The catalogue can be filtered by one category, as specified in `../admin/admin-manage-categories.md`.
- The empty catalogue has no sample courses and no Enroll or Open course control.
- Enroll inserts one row for the signed-in student and that course, with progress `0` and status `active`. It does not send `id` or `created_at`.
- A course the student has not joined offers Enroll and does not offer Open course.
- A course the student has already joined offers Open course and does not offer Enroll. Open course goes to `/student/my-courses/$courseId`.
- After a successful enroll, the screen stays on Browse Courses, the banner can be dismissed, and that card offers Open course.
- The learning view lists lessons only when the student is enrolled, in `order_index` order with nulls last, then `created_at`. It does not show lessons before enrollment. A valid `http` or `https` video URL is a plain-text link opened in a new tab. Any other video URL is omitted. Lesson content stays text.
- A missing course, or a course the student has not joined, shows no lesson list. An enrolled course with no lessons shows an empty list and no sample lessons.
- There is no unenroll control and no lesson editing. Enroll does not create a lesson, assignment, or submission.
- An instructor or admin does not get these screens.
- A failed course, enrollment, or lesson load shows the error and does not offer Enroll or show sample lessons.
