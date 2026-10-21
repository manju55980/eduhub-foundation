# Admin archive course

Specifies how an admin archives a published course. Publishing a pending course stays in `admin-approve-courses.md`. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, route sidebar item, or migration. It adds the file route `/admin/courses/archive`.

## Route

`/admin/courses/archive` is Archive Courses. The heading is “Archive Courses”. It is not a sidebar item. A back link returns to Manage Courses. Approve Courses links here with the text “Archive a published course”. Do not add that link to the admin sidebar. The card summary opens `/admin/courses/$courseId`, specified in `../course-details.md`. Archive stays outside that link. Each published course is a card.

## Schema and RLS

No schema change and no RLS change. The applied rules already cover this screen:

| Need                   | What already exists                                                                                                                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read published courses | `courses_select` lets an admin read every course. This screen still requests only `status = published`.                                                                                                                                                           |
| Read the instructor    | `profiles_select_admin` lets an admin read every profile. This screen requests only `id` and `full_name`.                                                                                                                                                         |
| Archive                | `courses_update_admin` allows an admin update. `courses_guard_update` allows an admin to change only `status`, and only from `pending` to `published` or from `published` to `archived`. This screen sends the second transition.                                 |
| Hide new enrollments   | `enrollments_insert_student` requires `is_published_course`. An archived course does not accept a new enrollment. An existing enrollment remains. Students who already joined keep course, lesson, and assignment access. This screen does not change those rows. |
| No other status        | The trigger rejects every other admin status change, including restoring an archived course.                                                                                                                                                                      |

Do not add an unarchive transition, a delete grant, or a lesson requirement.

## Listing

Read with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The query lives in `features/admin/`. Do not use the service-role client.

List courses with `status = published`, newest `created_at` first. Draft, pending, and archived courses are not listed. Do not add search, filters, pagination, lesson lists, enrollment counts, or grades.

Show each course’s stored `title`, `description`, `level`, and `created_at`. A null `title` or `description` is shown blank. Do not substitute a made-up name. Show the owning profile’s stored `full_name`. A null or missing name is blank. Still show the course.

If the course query or profile query fails, show that error and do not offer Archive. An empty published list is an empty state, not sample courses.

## Archive

Archive sends only `status: "archived"` for that course. It does not send `title`, `description`, `level`, `instructor_id`, `id`, or `created_at`.

The control is shown only for a course on this published list. If the trigger rejects the update, show that database error and leave the course on the list. Do not claim it was archived.

Archiving does not create or delete a lesson, enrollment, assignment, or submission. It does not change progress, grades, or feedback. There is no unarchive, reject, publish, edit, or delete control.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, white bordered cards, and the existing button primitives. Reuse `SaveNotice`.

- **Loading.** The published list is not shown yet. Do not offer Archive and do not show sample courses.
- **Ready.** The list shows the loaded published courses, or the empty state. Each published course has Archive.
- **Submitting.** The Archive control that was used does not send a second update.
- **Archived.** Stay on this screen. That course leaves the published list. The banner says “This course was archived.” It can be dismissed. Dismissing it does not change the status back or change the route.
- **Error.** Show the Supabase error inline. An error replaces the success banner. A failed archive leaves that course published.

No second visual system.

## Authorization

The admin layout already calls `requireRole("admin")`. A student or instructor is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- Publishing a pending course. That stays on Approve Courses and still sends only `published`.
- Rejecting a pending course, and restoring an archived course. Those transitions are not specified.
- Editing course or lesson fields, and listing lessons on this screen.
- Enrollment, grade, and submission changes.
- Manage Users, categories, reports, and the admin dashboard. Manage Users is specified in `admin-manage-users.md`. Manage Categories is specified in `admin-manage-categories.md`.

## Acceptance criteria

- An admin sees published courses, newest `created_at` first. Draft, pending, and archived courses are not listed.
- Each card shows the stored title, description, level, created time, and the instructor’s stored name. A null or missing name is blank. Lessons are not listed.
- The empty list has no sample courses and no Archive control.
- A failed course or profile load shows the error and does not offer Archive.
- Archive updates only `status` to `archived`. It does not send the other course columns.
- The screen does not offer unarchive, publish, reject, edit, or delete.
- After success, the screen stays on Archive Courses, the course leaves the list, and the banner can be dismissed without undoing the archive.
- A failed archive shows the database error and leaves the course on the list.
- Archiving does not create or delete a lesson, enrollment, assignment, or submission.
- Approve Courses still lists only pending courses and still publishes with `status: "published"`. Its only addition is the link to this screen.
- This screen is not a sidebar item. A student or instructor does not get it.
- No table, column, policy, or migration is added.
