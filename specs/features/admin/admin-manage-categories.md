# Admin Manage Categories

Specifies categories and where they appear. Publishing stays in `admin-approve-courses.md`. Archiving stays in `admin-archive-course.md`. User promotion stays in `admin-manage-users.md`. Creating a course stays in `../instructor/instructor-course-creation.md`. Draft course edits stay in `../instructor/instructor-my-courses.md`. The published catalogue stays in `../student/student-browse-courses.md`.

These decisions are recorded. The database change is `supabase/migrations/20261010233000_create_categories.sql`. That migration is local and has not been applied.

## Route

`/admin/categories` is Manage Categories. The heading is “Manage Categories”. It is a sidebar item, so it has no back link. The existing file route stays in place. Do not add a category-detail route. Each category is a card.

## Schema

One new table, `categories`:

| Column       | Rule                                                       |
| ------------ | ---------------------------------------------------------- |
| `id`         | UUID primary key. The database assigns it.                 |
| `name`       | Required text. Stored trimmed, never null or `""`. Unique. |
| `created_at` | `timestamptz`, default `now()`. Not collected on the form. |

`courses.category_id` is a nullable foreign key to `categories.id`. A course has one category or none. `ON DELETE RESTRICT` blocks a delete while any course references the category, including a draft. Deleting a category does not clear or delete those courses.

`courses.level` stays `beginner`, `intermediate`, or `advanced`. It is not a category.

This is the one hard delete in the product. Every other row stays undeletable. A category with no course may be deleted. A category that any course uses may not.

No other category column. A course does not store many categories.

## RLS

No service role. The signed-in browser client is the only client.

| Action                     | Who                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Select every category      | Any signed-in user. Students need the names for the catalogue filter. Instructors need them on the course form. Admins need them here. |
| Insert, rename, and delete | An admin, through `current_app_role() = 'admin'`. Students and instructors have no write policy.                                       |
| Set `courses.category_id`  | The owning instructor, on insert and on a draft field save. An admin still cannot change course columns other than `status`.           |

`courses_guard_update` must treat `category_id` like the other instructor fields: the owning instructor may change it, and an admin update that changes it is rejected. Add `category_id` to the instructor update grant. Do not grant course delete.

Rename sends only `name`. Create sends only `name`. Delete sends no column update.

## Admin actions

List every category, newest `created_at` first. Each card shows the stored `name` and `created_at`. A form creates one category. An existing card can rename it. Each card can delete it.

Trim `name`. Reject a blank name before the write. Store the trimmed text. There is no length limit. If the unique name rejects the write, show that database error and leave the entered name in place.

Delete is offered for every category. The foreign key is the safeguard. If a course still references it, show that database error and leave the category on the list. Do not hide the control as the only safeguard, and do not null out the courses.

- **Loading.** The list is not shown yet. Do not offer create, rename, or delete.
- **Ready.** The loaded categories, or the empty state. The empty state has the create form and no sample categories.
- **Saved.** Stay on this screen. A created category appears on the list and the create form clears. A renamed category shows the stored name. A deleted category leaves the list. The banner names what happened and can be dismissed. Dismissing it does not undo the write.
- **Error.** Show the database error inline. An error replaces the banner. A failed delete leaves the category listed.

## Instructor

On Create Course, and on the draft editor in My Courses, category is an optional select of the stored category names. No selection stores `category_id` null. The control is not marked required. Pending, published, and archived courses stay read-only, so their category cannot be changed there.

The create insert and the draft field save may send `category_id`. They still do not send `status` on a field save. Submit for approval still sends only `status`.

## Student

Browse Courses still lists `status = published`, newest `created_at` first. A category control defaults to all categories. That default includes courses with a null `category_id`. Choosing one category lists only published courses with that `category_id`.

Each catalogue card shows the stored category name beside the existing title, description, level, and created time. A null category is blank. Draft, pending, and archived courses stay off this catalogue. The filter does not search text and does not add pagination.

If the category query fails, show that error and do not show the catalogue or the filter.

## Authorization

The admin layout already calls `requireRole("admin")`. A student or instructor is redirected before Manage Categories mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. Do not hand-edit `src/integrations/supabase/types.ts` beyond the `categories` table and `courses.category_id` that match this migration. Regenerate that file from the database after the migration is applied.

## Out of scope

- Many categories on one course.
- Turning `level` into a category.
- Editing a category on a course that is no longer `draft`.
- Approve Courses, enrollments, grades, and lessons.
- Reports and the admin dashboard.

## Acceptance criteria

- `categories` has `id`, `name`, and `created_at`. `name` is required, trimmed, and unique. `courses.category_id` is optional and references one category. Delete is restricted while any course uses it.
- An admin can create, rename, and delete a category. Delete of a category that a course uses fails and leaves the category listed.
- An instructor can set or clear `category_id` when creating a course and while editing a draft. Later statuses do not offer that edit.
- A student can view all published courses or only those in one category. A course with no category appears in the unfiltered list and has a blank category name.
- Students and instructors cannot create, rename, or delete a category. An admin cannot change `category_id` through a course-status update.
- No service role. The migration stays local until it is applied on request.
