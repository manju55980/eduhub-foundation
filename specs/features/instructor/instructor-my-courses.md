# Instructor My Courses

Specifies the instructor course list and lesson management. Creating a course stays in `instructor-course-creation.md`. Roles, status transitions, and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, or migration.

## Routes

| Path                                    | What it is                                                            |
| --------------------------------------- | --------------------------------------------------------------------- |
| `/instructor/courses`                   | My Courses. Sidebar label: “My Courses (including lessons)”.          |
| `/instructor/courses/$courseId/lessons` | Lessons for one course the instructor owns. No separate sidebar item. |

Create Course remains `/instructor/courses/new`. AI Course Builder is `/instructor/courses/generate`, specified in `instructor-ai-course-builder.md`. Do not add another lesson route. Assignment authoring is a separate course route in `instructor-assignment-management.md`.

## Course list

A signed-in instructor sees the `courses` rows RLS already returns for them: `courses_select` allows an instructor to read a course only when `instructor_id` is the session user. That includes `draft`, `pending`, `published`, and `archived`. Do not hide a status in the client.

Read with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The query lives in `features/instructor/`. Do not use the service-role client.

Show each course’s stored `title`, `description`, `level`, and `status`. Show `created_at`. The saved title opens that course’s details page, specified in `../course-details.md`. On a draft, the inputs and save controls stay outside that link. Order by `created_at` descending. Do not add search, filters, pagination, enrollment counts, grades, or assignment counts.

An empty list is an empty state, not sample courses. Link to the existing Create Course route. The heading is “My Courses (including lessons)”. This page has no back link; it is a sidebar item.

A null `title` or `description` is shown blank. Do not substitute a made-up name.

## Statuses and actions

`courses_guard_update` is the status rule. The only instructor status change is `draft` to `pending`. The update sends `status` and no other column.

| Status      | Instructor action in this feature                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `draft`     | Edit title, description, level, and the optional category on this course’s card. Submit for approval when it has at least one lesson. Open lessons. Category edit is specified in `../admin/admin-manage-categories.md`. |
| `pending`   | Open lessons. The card shows the stored fields and has no edit form and no status control.                                                                                                                               |
| `published` | Open lessons. The card shows the stored fields and has no edit form and no status control. Archive is an admin action.                                                                                                   |
| `archived`  | Open lessons. The card shows the stored fields and has no edit form and no status control. Restoring an archived course is not specified.                                                                                |

Submit for approval is on the draft card, separate from saving title, description, level, or category. A field save must not send `status`. Submitting must not change title, description, level, `category_id`, `instructor_id`, `id`, or `created_at`.

Submit only when that course has at least one lesson. The status trigger does not check lessons, so this screen checks before it sends the update. It does not add a database constraint. With no lessons, the card does not offer submit; it links to that course’s lessons page. The lessons page does not submit the course.

After a successful submit, this screen shows the course as `pending` and removes the edit form and the submit control. That course is what `/admin/courses/approvals` lists. Publishing it stays in `features/admin/admin-approve-courses.md`. This screen does not publish it.

There is no delete control. `courses` has no delete grant, and parent deletes stay restricted.

Do not offer publish, archive, reject, unarchive, or any status value other than `pending` from `draft`. If the trigger rejects the update, show that database error and leave the status unchanged on screen until the list is loaded again.

## Course fields

The instructor update grant is `title`, `description`, `level`, `status`, and `category_id`. The category column grant is in `supabase/migrations/20261010233000_create_categories.sql`. This feature’s field save sends only `title`, `description`, `level`, and `category_id`.

Use the same rules as Create Course for those three fields: trim, reject a blank title or description, store the trimmed text, require `level` to be `beginner`, `intermediate`, or `advanced`, and keep the 2,000-character limit on the description control only. Do not add a database length check.

The form does not collect `instructor_id`, `status`, `id`, or `created_at`.

The form is on the draft course card on `/instructor/courses`. It is not on the lessons page, and it is not a new route. After the course leaves `draft`, the card no longer shows the form. The database would still allow those column updates; this screen does not send them.

## Lessons

`/instructor/courses/$courseId/lessons` loads that course with the signed-in client. If the course row is not returned, show that it is not available. Do not show a lesson form and do not insert a lesson.

The heading is the course title when one is stored, otherwise “Lessons”. The back link goes to `/instructor/courses` and its label is “My Courses (including lessons)”.

Lesson RLS:

- Select: the owning instructor, an admin, or an enrolled student. This screen is still instructor-only because the instructor layout already calls `requireRole("instructor")`.
- Insert: an instructor, and only when `is_course_owner(course_id)` is true. `course_id` is the route id.
- Update: the owning instructor may change `title`, `content`, `video_url`, and `order_index` only. The update grant does not include `course_id`, `id`, or `created_at`. Do not send those columns. This screen also does not send `order_index` on edit. A lesson cannot be moved to another course.
- Delete: no grant. Do not offer delete.

Lesson policies do not check course status. Do not add a client-side status gate unless a later decision adds one.

List the course’s lessons with no sample rows. Order by `order_index` ascending, nulls last, then `created_at` ascending. Show each lesson’s stored `title`, `content`, `video_url`, and `order_index`.

The page can create a lesson and edit an existing one. Both stay on this page. A create saves one row and then clears the form so the same lesson is not inserted twice. An edit leaves the saved values in place. Neither save changes the course status or edits the course fields. This screen does not write `enrollments`. After a lesson insert, the database recalculates `enrollments.progress` for that course, as specified in `../student/student-lesson-completion.md`. An edit of lesson text does not clear a student’s completion.

| Column        | On create                                                                                                                         | On edit                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `title`       | Required. Trimmed text. Reject blank.                                                                                             | Same.                      |
| `content`     | Required. Trimmed text. Reject blank.                                                                                             | Same.                      |
| `video_url`   | Optional. Trimmed text, or null when blank. No URL format check.                                                                  | Same.                      |
| `order_index` | Not on the form. The insert sets it to one more than the highest existing `order_index` for that course, or `1` when none is set. | Not on the form. Not sent. |
| `course_id`   | The route id. Not collected.                                                                                                      | Not sent.                  |

Do not store `""`. Do not add a character limit. The table does not make `order_index` unique, and this screen does not reject a duplicate. Do not add that constraint. The lessons page does not edit course title, description, level, or status.

## Authorization

The instructor layout already calls `requireRole("instructor")`. A student or admin is redirected before these screens mount. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not use the service-role client. Do not hand-edit `src/integrations/supabase/types.ts`.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, white bordered cards, and the existing button, input, and textarea primitives.

- **Ready.** The list shows the loaded courses, or the empty state. The lessons page shows the loaded lessons, or an empty lesson list.
- **Submitting.** The control that was used does not send a second request.
- **Saved.** Stay on the same screen. The banner says “Course changes were saved.”, “This course was submitted for approval.”, “This lesson was saved.”, or “This lesson was updated.” It can be dismissed. Dismissing it does not undo the save or change the route.
- **Error.** Show the Supabase or form error inline. An error replaces the success banner. Leave the entered values in place.

No second visual system. No enrollment or grade data on these screens. The course card links to assignments; it does not list assignment rows. That link and the assignment screen are specified in `instructor-assignment-management.md`.

## Out of scope

- Creating a course, submissions, grading, and enrollment progress. Assignment authoring is specified in `instructor-assignment-management.md`.
- Admin publish and archive.
- Student lesson viewing.
- Deleting or moving a course or lesson.
- Status changes other than `draft` to `pending`.
- Categories, dashboards, and reports.

## Acceptance criteria

- An instructor sees only their own courses, in every status, newest `created_at` first. Another instructor’s course is not listed.
- The empty list has no sample courses and links to Create Course.
- Submit for approval is offered only for a `draft` that already has a lesson. It updates only `status` to `pending`. A draft with no lessons links to the lessons page and does not send that update.
- Pending, published, and archived courses have no edit form and no instructor status control. There is no delete control.
- A draft field save is on the course card, does not send `status`, and uses the Create Course rules for title, description, and level. The lessons page does not edit those fields.
- The lessons page loads lessons only for a course returned to that instructor. A missing course shows no form and inserts nothing.
- A new lesson requires a trimmed title and trimmed content, stores a blank video URL as null, and gets the next `order_index`. An edit does not change `order_index`. A lesson save does not change `course_id`, `id`, `created_at`, or the course, and does not delete a lesson.
- A student or admin does not get these screens.
- These screens do not publish, archive, enroll, grade, or create an assignment or submission.
