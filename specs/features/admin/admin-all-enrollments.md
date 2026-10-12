# Admin All Enrollments

Specifies the All Enrollments screen. An admin reads every enrollment. Publishing stays in `admin-approve-courses.md`. A student’s own enrolled-course list stays in `../student/student-my-courses.md`. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, route, or migration.

## Route

`/admin/enrollments` is All Enrollments. The heading is “All Enrollments”. It is a sidebar item, so it has no back link. The existing file route stays in place. Do not add an enrollment-detail route. Each enrollment is a card.

## Schema and RLS

No schema change and no RLS change. The applied rules already cover this screen:

| Need                  | What already exists                                                                                                                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read every enrollment | `enrollments_select` returns every enrollment when `current_app_role()` is `admin`. A student sees only `student_id` equal to the session user. An instructor sees enrollments only for a course `is_course_owner` accepts.                                                                          |
| Read the course       | `courses_select` lets an admin read every course, including `archived`. `enrollments_insert_student` allows a new enrollment only when the course is published, so a draft or pending course has no enrollment. An existing enrollment remains after archive.                                        |
| Read the student name | `profiles_select_admin` lets an admin read every profile. This screen requests only `id` and `full_name`. It does not request `email`, `phone`, or `role`.                                                                                                                                           |
| Enrollment status     | `enrollments_sync_status` sets `status` to `completed` when `progress` is 100 and `active` otherwise. This screen shows that stored status. It does not show `progress`. The update grant is `progress` only, and `enrollments_update_instructor` allows that update only for the owning instructor. |
| No admin write        | There is no admin update policy and no delete grant. An admin does not set progress.                                                                                                                                                                                                                 |

Do not add a column, a progress bar, or an admin update or delete policy.

## Listing

Read with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The query lives in `features/admin/`. Do not use the service-role client. Do not filter the enrollment query to the signed-in admin.

List every enrollment this admin can read. Then read each enrollment’s course `title` and `status`, and the student’s `full_name`.

Order by the enrollment `created_at` descending, the same order as Student My Courses. Do not add search, filters, pagination, lesson lists, grades, or a count of other students.

If the enrollment query, course query, or profile query fails, show that error and do not show cards. An empty enrollment list is an empty state, not sample enrollments. It has no controls.

If an enrollment’s course row is not returned, omit that enrollment. Do not invent a title or a card for it. If the profile row is not returned, still show the enrollment. A null or missing name is blank.

An archived course that still has an enrollment is listed. Do not hide it because the course is no longer published.

## Enrollment details

Each card shows the stored course `title` as its heading, the student’s stored `full_name`, the stored course `status`, the enrollment `status`, and the enrollment `created_at`.

A null title or name is shown blank. Do not substitute a made-up name. Do not show `progress`. Enrollment status is the stored `active` or `completed` value. Course status is the stored `draft`, `pending`, `published`, or `archived` value.

Do not show the course `description`, `level`, or course `created_at`. Do not show `email`, `phone`, `role`, lessons, grades, feedback, or another admin’s private account fields.

## Actions

This screen does not insert, update, or delete an enrollment, course, profile, lesson, assignment, or submission. There is no progress control, unenroll control, archive control, or delete control. There is no success banner, because this screen does not write.

There is no Open course control. This screen does not add an admin learning route.

## UI

Follow the visual direction in `product.md`. Use `PageHeader` and white bordered cards. Do not add a form.

- **Loading.** The list is not shown yet. Do not show sample enrollments.
- **Ready.** The list shows the loaded enrollments, or the empty state.
- **Error.** Show the Supabase error inline. Do not show cards and do not show sample enrollments.

No second visual system.

## Authorization

The admin layout already calls `requireRole("admin")`. A student or instructor is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- Showing or updating `progress`. The assignment does not include progress on All Enrollments. No screen updates `progress`. The existing `enrollments_update_instructor` grant stays unchanged. Student My Courses still shows the stored percentage.
- Enroll and unenroll.
- Archiving or publishing a course. Those stay on course status, not on this screen.
- Grades and submissions. An admin can already select them; this screen does not list them.
- Lessons, Manage Users, categories, reports, and the admin dashboard. Manage Users is specified in `admin-manage-users.md`. Manage Categories is specified in `admin-manage-categories.md`.
- Instructor and student screens.

## Acceptance criteria

- An admin sees every enrollment, newest enrollment `created_at` first. The list is not limited to published courses.
- An enrollment in an archived course is listed. A draft or pending course does not gain an enrollment from this screen.
- Each card shows the stored course title, student name, course status, enrollment status, and enrollment created time. It does not show progress. A null or missing name is blank. A missing course row has no card.
- The card does not show progress, course description, level, course created time, email, phone, role, lessons, grades, or feedback.
- The screen does not write. It has no progress, unenroll, archive, delete, or Open course control, and no success banner.
- The empty list has no sample enrollments and no controls.
- A failed enrollment, course, or profile load shows the error and does not show cards.
- No table, column, policy, or migration is added.
- A student or instructor does not get this screen.
