# Admin approve courses

Specifies the Approve Courses screen. An admin reviews pending courses and publishes one. Archiving a published course stays in `admin-archive-course.md`. Reject and the other admin screens stay out of this feature. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, route, or migration.

## Route

`/admin/courses/approvals` is Approve Courses. The heading is “Approve Courses”. The sidebar item for courses is Manage Courses at `/admin/courses`, specified in `admin-manage-courses.md`. This page has a back link to Manage Courses. A text link, “Archive a published course”, opens `/admin/courses/archive`. That link does not archive a course. The card summary opens `/admin/courses/$courseId`, specified in `../course-details.md`. Approve stays outside that link. The lesson list also stays outside that link so a video URL can be opened on its own. Each pending course is a card.

## Listing

A signed-in admin can read every course. This screen still requests only `status = pending`. Those rows are courses an instructor submitted from `draft`. This screen does not submit a course. Draft, published, and archived courses are not listed.

Read with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The query lives in `features/admin/`. Do not use the service-role client.

Order by `created_at` descending. Do not add search, filters, pagination, or enrollment counts.

Show each course’s stored `title`, `description`, `level`, and `created_at`. A null `title` or `description` is shown blank. Do not substitute a made-up name. Show the owning profile’s stored `full_name`. Admins can read every profile. A null name is shown blank.

Also show that course’s lessons, read-only. `lessons_select` allows an admin to read them. Order by `order_index` ascending, nulls last, then `created_at` ascending. Show each lesson’s stored `title`, `content`, and `video_url`. A null title or content is shown blank. Show `video_url` only when the stored value is an absolute `http` or `https` URL, as a link that opens in a new tab. A blank or other value is omitted. A pending course with no lessons is an empty lesson list, not sample lessons. The database does not require a lesson before `pending`, so an empty list does not block publish.

If the course query, profile query, or lesson query fails, show that error and do not offer Approve. An empty pending list is an empty state, not sample courses.

## Publish

Approve sends only `status: "published"` for that course. It does not send `title`, `description`, `level`, `instructor_id`, `id`, or `created_at`.

`courses_guard_update` allows an admin to change a course only from `pending` to `published`, or from `published` to `archived`, and only the status column. This screen offers the first transition only. It does not offer archive, reject, unpublish, or any other status.

The control is shown only for a course on this pending list. If the trigger rejects the update, show that database error and leave the course on the list. Do not claim it was published.

Publishing does not create a lesson, enrollment, assignment, or submission. There is no delete control.

A published course then matches the student catalogue, which lists `status = published`. This screen does not navigate there.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, white bordered cards, and the existing button primitives.

- **Loading.** The pending list is not shown yet. Do not offer Approve and do not show sample courses.
- **Ready.** The list shows the loaded pending courses, or the empty state. Each pending course has Approve.
- **Submitting.** The Approve control that was used does not send a second update.
- **Published.** Stay on this screen. That course leaves the pending list. The banner says “This course was published.” It can be dismissed. Dismissing it does not change the status back or change the route.
- **Error.** Show the Supabase error inline. An error replaces the success banner. A failed publish leaves that course pending.

No second visual system. No grade, enrollment count, or course editing on this screen.

## Authorization

The admin layout already calls `requireRole("admin")`. A student or instructor is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- Archiving a published course. The trigger allows `published` to `archived`. This screen does not send it. The archive screen is specified in `admin-archive-course.md`.
- Rejecting a pending course, and restoring an archived course. Those transitions are not specified.
- Editing course or lesson fields.
- Manage Users, categories, reports, and the admin dashboard. Manage Users is specified in `admin-manage-users.md`. Manage Categories is specified in `admin-manage-categories.md`. All Enrollments is specified in `admin-all-enrollments.md`.
- Instructor and student screens.

## Acceptance criteria

- An admin sees pending courses, newest `created_at` first. Draft, published, and archived courses are not listed.
- Each card shows the stored title, description, level, created time, and the instructor’s stored name, plus that course’s lessons in `order_index` order with nulls last, then `created_at`.
- The empty list has no sample courses and no Approve control.
- A failed course, profile, or lesson load shows the error and does not offer Approve.
- Approve updates only `status` to `published`. It does not send the other course columns.
- The screen does not archive a course, and it does not offer reject, unpublish, edit, or delete. The text link opens the archive screen.
- After success, the screen stays on Approve Courses, the course leaves the pending list, and the banner can be dismissed without undoing the publish.
- A failed publish shows the database error and leaves the course pending.
- Publishing does not create a lesson, enrollment, assignment, or submission.
- A student or instructor does not get this screen.
