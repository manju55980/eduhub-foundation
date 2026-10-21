# Admin course management

Specifies the unified course page. Publishing a pending course stays in `admin-approve-courses.md`. Archiving a published course stays in `admin-archive-course.md`. Course details stay in `../course-details.md`. Roles and the route map stay in `product.md`. This page adds no table, column, policy, or migration.

## Route

`/admin/courses` is Manage Courses. The heading is “Course Management”. It is the admin sidebar item for courses, so it has no back link. `/admin/courses/approvals` and `/admin/courses/archive` stay available and are not sidebar items.

The card summary and “View details” open `/admin/courses/$courseId` with `from=manage`. Approve and Archive stay outside that link.

## What it shows

An admin sees every course `courses_select` returns: draft, pending, published, and archived. The list is not sample data. A search matches the course title or the instructor name. Status filters are All, Pending, Published, Draft, and Archived. Counts use the loaded courses, and choosing a count applies that status filter. The default order is newest `created_at` first. Oldest first is the other order.

Each card shows the title, status, instructor, level, description, and created date. A pending card also lists its lessons. A lesson video URL that is a web URL opens in a new tab. Approve is shown only for `pending`. Archive is shown only for `published`. Draft and archived cards have View details and no status action. There is no Reject control. The database still allows only `pending` to `published` and `published` to `archived`.

## States

- **Loading.** The courses are not shown yet. Do not offer Approve or Archive.
- **Ready.** The loaded courses, or the empty sentence for the current filter and search.
- **Submitting.** The control that was used does not send a second update.
- **Published.** Stay on this page. That course’s status becomes Published. The banner says “This course was published.” Dismissing it does not undo the publish.
- **Archived.** Stay on this page. That course’s status becomes Archived. The banner says “This course was archived.” Dismissing it does not undo the archive.
- **Error.** Show the load error and do not offer Approve or Archive.

The page uses the existing bordered panels, status badges, and the width of the admin content area. It does not add pastel count tiles, charts, or a second visual system.

## Out of scope

- Rejecting a course, deleting a course, or editing its fields.
- Changing who can publish or archive.
- Moving Approve or Archive onto the course details page.
