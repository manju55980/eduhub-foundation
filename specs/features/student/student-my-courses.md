# Student My Courses

Specifies the enrolled-course list. Browsing, enrolling, and the learning view stay in `student-browse-courses.md`. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, route, or migration.

## Route

`/student/my-courses` is My Courses. The heading is “My Courses”. It is a sidebar item, so it has no back link. The existing file route stays in place. Do not add a course-detail route.

Open course goes to the existing learning view, `/student/my-courses/$courseId`. Do not change that screen. Its heading, lesson list, and back link stay as specified in `student-browse-courses.md`. The back link still goes to `/student/courses` and its label is still “Browse Courses”.

## Listing

This screen lists courses the signed-in student has joined. It does not list a published course the student has not joined. Enrollment is still only on Browse Courses.

`enrollments_select` lets a student read an enrollment only when `student_id` is the session user. Read those rows, then the `courses` rows for their `course_id` values. `courses_select` returns a course to a student when it is `published` or when `is_enrolled` is true, so an archived course the student already joined is included. Draft and pending courses are not enrolled, so they are not listed.

Read with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin and passes the session user id, as Browse Courses does. The query lives in `features/student/`. Do not use the service-role client.

Order by the enrollment `created_at` descending. Do not add search, filters, pagination, lesson counts, or a count of other students.

If the enrollment query or the course query fails, show that error and do not offer Open course. An empty enrollment list is an empty state, not sample courses. Link that empty state to `/student/courses`. The link label is “Browse Courses”.

If an enrollment’s course row is not returned, omit that enrollment. Do not invent a title or a card for it.

## Course details

Each card shows the stored course `title`, `description`, and `level`, and the course `created_at`. A null `title` or `description` is shown blank. Do not substitute a made-up name. A student cannot read another person’s profile, so a card does not show an instructor name.

Also show the stored course `status`, the enrollment `progress`, the enrollment `status`, and the enrollment `created_at`. Progress is the stored integer from 0 to 100. Show it as that percentage. Enrollment status is the stored `active` or `completed` value. Do not calculate a different progress, and do not add a progress bar. The animated progress tracker stays a bonus.

Do not list lessons on this screen. Lessons stay on the learning view, and only after enrollment, as `student-browse-courses.md` already specifies.

## Actions

The only action is Open course, on every card that is shown. It goes to `/student/my-courses/$courseId`. There is no Enroll control here.

This screen does not insert, update, or delete an enrollment. It shows the stored `progress` and does not offer a progress control. The assignment does not specify who updates progress after enrollment, and no screen updates it. There is no unenroll control and no delete grant. It does not change course status, and it does not create a lesson, assignment, or submission.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, white bordered cards, and the existing button primitives.

- **Loading.** The list is not shown yet. Do not offer Open course and do not show sample courses.
- **Ready.** The list shows the loaded enrollments, or the empty state. Each shown course has Open course.
- **Empty.** No enrollment rows. The empty state links to Browse Courses. It has no Open course control.
- **Error.** Show the Supabase error inline. Do not offer Open course and do not show sample courses.

No second visual system. No assignment, grade, or other student’s enrollment on this screen. There is no success banner, because this screen does not write.

## Authorization

The student layout already calls `requireRole("student")`. An instructor or admin is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- Enroll, unenroll, and changing progress or enrollment status.
- Changing the learning view, including its back link.
- Assignments and submissions. Listing and submitting are specified in `student-assignment-submission.md`.
- Grades. Those are specified in `student-my-grades.md`.
- Instructor and admin screens.
- Categories, dashboards, reports, and the animated progress tracker.

## Acceptance criteria

- A student sees only courses they are enrolled in, newest enrollment `created_at` first. A published course they have not joined is not listed.
- An archived course they already joined is listed. Draft and pending courses are not listed.
- Each card shows the stored title, description, level, course status, and course created time, plus the stored progress percentage, enrollment status, and enrollment created time. It does not show an instructor name, lessons, or a progress bar.
- Open course goes to `/student/my-courses/$courseId`. The learning view is unchanged, including its back link to Browse Courses.
- The empty list has no sample courses and no Open course control. It links to Browse Courses.
- A failed enrollment or course load shows the error and does not offer Open course.
- An enrollment whose course row is not returned has no card.
- There is no Enroll, unenroll, or progress control. This screen does not write an enrollment, lesson, assignment, or submission.
- An instructor or admin does not get this screen.
