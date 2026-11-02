# Instructor course materials

Specifies instructor uploads for a course they own. Lessons stay in `instructor-my-courses.md`. Assignments stay in `instructor-assignment-management.md`. Student submissions stay text or a link in `submissions.content_url`. Roles and the route map stay in `product.md`. Columns stay in `architecture.md`.

This slice is additional to the scored tracks in `assessment-3/assessment-3.md`. It does not replace them.

The migration that adds `course_materials`, the private bucket, and the content freeze is specified here and in `architecture.md`. It is not in the repository until this feature is implemented. It is not applied until that is asked for. It runs after `supabase/migrations/20261010233000_create_categories.sql`, because the freeze replaces `courses_guard_update` and that replacement still mentions `category_id`.

## Route

| Path | What it is |
| --- | --- |
| `/instructor/courses/$courseId/materials` | Materials for one course the instructor owns. No separate sidebar item. |

Each course card on `/instructor/courses` links here. The link label is “Materials”. It is shown for every course status, next to Lessons and Assignments. Instructor course details links here too. The heading is the course title when one is stored, otherwise “Materials”. The back link goes to `/instructor/courses` and its label is “My Courses”.

## Files

A material is one object in the private bucket `course-materials`, plus one `course_materials` row. The object is not public. The row stores the name, the MIME type, the size, and the object path. It does not store a URL.

Allowed types, and the extension that must match:

| Extension | `mime_type` |
| --- | --- |
| `pdf` | `application/pdf` |
| `docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `txt` | `text/plain` |
| `png` | `image/png` |
| `jpg`, `jpeg` | `image/jpeg` |

The maximum size is 20 MB, stored as 20,971,520 bytes. A file of that size is accepted. One byte more is rejected. A empty file is rejected. The bucket `file_size_limit` and `allowed_mime_types` are the same list. The table checks the same MIME values and the same size range.

`file_name` is the trimmed base name. Reject a blank name, `.`, `..`, and any name that contains `/` or `\`. The extension check is case-insensitive. A MIME type and an extension that disagree are rejected before the insert. No other character limit is added.

More than one file may be attached to the same course. The same file name may be used twice. A file is for the course, not for one lesson. This feature does not add `lesson_id`.

Submitting a course does not require a material. A draft with a lesson and no files can still be submitted.

## Content freeze

While `courses.status` is `draft`, the owning instructor may:

- change that course’s `title`, `description`, `level`, and `category_id`
- insert and update that course’s lessons
- insert and update that course’s assignments, including `due_date`
- insert a `course_materials` row and upload its object

After `status` leaves `draft`, those writes are rejected. Pending, published, and archived courses stay frozen. The only instructor status change is still `draft` to `pending`. Admin publish and archive are unchanged. There is no return to `draft`.

The freeze is enforced in the database, not only by hiding a form.

- `courses_guard_update` still lets an admin change only `status`, and only from `pending` to `published` or from `published` to `archived`. For an owning instructor, a change to `title`, `description`, `level`, or `category_id` is allowed only when the old status is `draft`.
- `is_draft_course(course_id)` is a security-definer function with an empty `search_path`. Only `authenticated` can execute it. Lesson insert and update, assignment insert and update, and material insert require it, together with the existing owner check. Select policies are not narrowed.
- A new lesson on a published course is what today recalculates enrollment progress. That insert is rejected after submit, so the lesson count used for progress stays as it was at submit.

The lessons screen and the assignments screen show their create and edit forms only when the loaded course is `draft`. On any other status they list the stored rows and do not offer save. A hidden form is not the only block. A direct write still fails the policy or the trigger.

## Upload

The screen uses the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The calls live in `features/instructor/`. Do not use the service-role client.

If the course row is not returned, show that it is not available. Do not show the form and do not insert.

On a draft the instructor selects one file. Reject the wrong extension, the wrong MIME type, or a size outside 1 through 20,971,520 bytes before any insert. Those are form errors.

When the file passes:

1. Insert `course_materials` with `course_id`, `file_name`, `mime_type`, and `byte_size`. Do not send `id`, `created_at`, or `storage_path`. A before-insert trigger sets `id` when it is missing and sets `storage_path` to `{course_id}/{id}/{file_name}`.
2. Upload the bytes to bucket `course-materials` at that `storage_path`, with the same MIME type.

The two steps are not one transaction. If the insert fails, show that database error and do not upload. If the insert succeeds and the upload fails, show the storage error and keep that row. Retry uploads to the same `storage_path`. It does not insert a second row. The list shows the file name. Download of a row whose object is missing shows the storage error.

There is no delete control and no delete grant. Replacing a file is not specified. See `product.md`.

## Who can read

`course_materials` select and object select use the same rule. Policies call security-definer helpers with an empty `search_path`. They do not subquery `courses` and `enrollments` into each other.

| Reader | Rule |
| --- | --- |
| Owning instructor | `is_course_owner(course_id)`, for every course status |
| Admin | `current_app_role() = 'admin'`, for every course status |
| Student | `is_enrolled(course_id)` only |

A student who can see a published course in the catalogue, and has not enrolled, cannot read the file. A student who enrolled can read it after the course is archived, which is the same rule as `lessons_select`.

Object select, and object insert for a draft the caller owns, are the only storage grants. There is no update or delete policy on `storage.objects` for this bucket. The object name’s first folder is the course id. A name that does not start with a course id the helper accepts is not readable and is not writable.

Download calls `createSignedUrl` for that path when the user activates Download. The URL lasts 60 seconds. It is not stored on the row. Do not put the bucket in a public URL.

## Where files are shown

| Place | What it does |
| --- | --- |
| `/instructor/courses/$courseId/materials` | Owner lists every file, newest `created_at` first, and uploads while the course is `draft`. |
| Instructor course details | Link “Materials”. It does not upload. |
| `/student/my-courses/$courseId` | Enrolled student sees the file name, type, and size, and can download. No upload. The catalogue page before enrollment does not list files. |
| Approve Courses and a pending card on Manage Courses | Admin sees the same file fields and can download. Specified with the review in `../admin/admin-course-review.md`. |
| Admin course details | Same file fields and download. No upload. |

Show the stored `file_name`, `mime_type`, and `byte_size`. Do not invent a display name. An empty list is an empty state, not a sample file. Byte size is shown in megabytes with one decimal, from `byte_size / 1048576`.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, the shared card surface, and the existing button primitives.

- **Loading.** The course and its files are not shown yet. Do not offer upload.
- **Missing course.** Say the course is not available. No form and no file list.
- **Ready.** The list shows the loaded files, or the empty state. The file input is shown only on a draft.
- **Frozen.** Pending, published, and archived courses list the files and do not show the file input.
- **Uploading.** The upload control does not start a second insert.
- **Saved.** Stay on this screen. The banner says “This file was uploaded.” It can be dismissed. Dismissing it does not remove the file or change the route.
- **Error.** Show the form, database, or storage error inline. An error replaces the success banner.

No second visual system. No lesson editor and no assignment editor on this screen.

## Authorization

The instructor layout already calls `requireRole("instructor")`. A student or admin is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`. Regenerate it after the migration is applied.

## Out of scope

- Student assignment files. `submissions.content_url` stays text or a link.
- Using `lessons.video_url` as a storage path. Video URLs stay `http` or `https` links.
- Attaching a file to one lesson.
- Deleting or replacing a material. That is unresolved in `product.md`.
- Reading the bytes inside a PDF, document, or image from an Edge Function. The review uses the file name and MIME type only. See `../admin/admin-course-review.md`.
- Publish, reject, and return to draft.

## Acceptance criteria

- An instructor can upload a PDF, DOCX, PPTX, TXT, PNG, or JPEG of at most 20,971,520 bytes to a draft course they own. The object is in the private bucket `course-materials`. The row stores the base name, the matching MIME type, the size, and `storage_path`.
- A file over that size, an empty file, a mismatched extension, or any other MIME type does not insert and does not upload.
- Another instructor’s course shows no form and inserts nothing.
- A pending, published, or archived course does not show the file input. A direct material insert, lesson write, assignment write, or course-field update on that course fails. `draft` to `pending` still succeeds when the screen’s lesson check passes.
- The owner, an admin, and an enrolled student can download. A student who is not enrolled cannot.
- The signed URL lasts 60 seconds and is not stored.
- There is no delete control. A failed upload does not insert a second row for that attempt.
- Submit still requires a lesson and does not require a file.
- A student or admin does not get the instructor materials screen.
