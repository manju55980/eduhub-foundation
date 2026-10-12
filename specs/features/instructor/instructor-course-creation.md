# Instructor course creation

Specifies the Create Course screen only. Roles, status transitions, and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

`/instructor/courses/new` is the Create Course screen. It does not list courses, edit them, add lessons, or submit a draft for approval.

## Behavior

A signed-in instructor saves one `courses` row. The database assigns `id` and `created_at`. `instructor_id` is the signed-in user. `status` is `draft`. The course stays hidden from students until an admin later publishes it.

## Fields

| Column             | On the form | Rule already in the schema                                                                        |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| `title`            | Yes         | Required. Stored as trimmed text, never null or `""`.                                             |
| `description`      | Yes         | Required. Stored as trimmed text, never null or `""`.                                             |
| `level`            | Yes         | Required. `beginner`, `intermediate`, or `advanced`.                                              |
| `category_id`      | Yes         | Optional. One category or null. The select is specified in `../admin/admin-manage-categories.md`. |
| `instructor_id`    | No          | Insert policy requires the signed-in user.                                                        |
| `status`           | No          | Insert policy allows only `draft`.                                                                |
| `id`, `created_at` | No          | Generated.                                                                                        |

## Authorization

The instructor layout already calls `requireRole("instructor")`. Someone else is redirected before this screen mounts. A missing profile still uses that layout's profile error.

Insert with the signed-in browser client from `@/integrations/supabase/client`, in a `features/instructor/` module. The route stays thin. Do not use the service-role client.

The insert is allowed only when `courses_insert_instructor` passes: role `instructor`, `instructor_id` is the session user, and `status` is `draft`. Students and admins have no insert policy.

`src/integrations/supabase/types.ts` is generated from the applied schema. Do not hand-edit it. This feature does not apply migrations.

## Validation

Do not send the insert unless `level` is one of the three schema values. Do not send a status other than `draft`, and do not let the form choose an owner.

Trim `title` and `description`. Reject the save when either trimmed value is empty. Store the trimmed text. The schema still has no length limit; do not add one.

## UI states

Follow the visual direction in `product.md`. The heading stays "Create Course". A back link returns to Instructor Dashboard. The form sits in a card; a supporting note sits beside it on wide screens.

Title, description, and level are marked required. Title hint: “This will be the name of your course.” Description hint: “Keep it clear and concise.” The description control shows a count out of 2,000 and does not accept more than 2,000 characters. That limit is only on the form. Level hint: “Select the appropriate level for your course.”

- **Ready.** Empty title and description. Level is unselected. The save control is available.
- **Submitting.** The save control does not send a second insert.
- **Saved.** Stay on this screen. Clear title, description, and level. Show a success banner that the course was saved as a draft. The banner can be dismissed. Dismissing it does not undo the save or leave the page. There is no “Create another course” control.
- **Error.** Show the Supabase error inline. Leave the entered values in place. A blank title or description is a form error, not a database error. An error replaces the success banner.

## Acceptance criteria

- An instructor can save a course with a trimmed title, trimmed description, and valid level. The new row is `draft`, owned by that instructor, and both text fields are non-null.
- A whitespace-only title or description does not insert a row.
- After a successful save, the form is cleared and a success banner is shown. Dismissing the banner stays on this page. The screen has no “Create another course” control.
- The description field does not accept more than 2,000 characters.
- The form does not collect `status`, `instructor_id`, `id`, or `created_at`.
- A student or admin does not get this screen and cannot insert a course.
- A failed insert shows the database error and does not claim the course was saved.
- Saving does not create a lesson, enrollment, assignment, or submission, and does not set `pending`.
