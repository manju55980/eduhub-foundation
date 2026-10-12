# Instructor AI Course Builder

Specifies how an instructor generates a course outline and saves it as a new draft. Manual course creation stays in `instructor-course-creation.md`. Lessons stay in `instructor-my-courses.md`. Assignments stay in `instructor-assignment-management.md`. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, or policy.

## Route

| Path                           | What it is                                     |
| ------------------------------ | ---------------------------------------------- |
| `/instructor/courses/generate` | AI Course Builder. Sidebar label matches that. |

The back link returns to Instructor Dashboard. Create Course remains `/instructor/courses/new`.

## Generate

A signed-in instructor enters a required brief, a required level, and an optional category. The brief is trimmed and at most 2,000 characters. Level is `beginner`, `intermediate`, or `advanced`. The category select is the same control Create Course uses.

Generate calls `supabase.functions.invoke("ai-course-builder")` with `{ brief, level }`. The call lives in `features/instructor/`. The route stays thin. Do not call Gemini from the browser.

The Edge Function checks the caller’s JWT and `profiles.role`. Only `instructor` is allowed. It does not read other instructors’ courses, lessons, assignments, grades, or submissions, and it does not insert rows. The model is `gemini-3.5-flash-lite`.

The preview has a title, a description of at most 2,000 characters, up to 6 lessons (`title`, `content`), and up to 4 assignments (`title`, `description`). The function drops any status, owner, due date, video URL, id, or `created_at` in the model reply. `due_date` and `video_url` stay unset.

Generate does not insert. The instructor can edit the preview text and remove a lesson or assignment before saving. Brief, level, and category stay as they were when Generate ran and are disabled while the preview is open. Discard preview clears the preview and does not insert or delete.

## Save

Save validates the edited preview before any insert. Do not trust the model reply or the edited text without that check.

- Title and description are trimmed and required. A description longer than 2,000 characters is rejected.
- Level is still one of the three schema values.
- Category is empty or one of the categories loaded for the select.
- At least one lesson, and at most 6. Each lesson title and content is trimmed and required. `video_url` is null. `order_index` is 1 through n in the edited order.
- At most 4 assignments. Each assignment title and description is trimmed and required. `due_date` is null.
- A failed check shows the form error and does not insert.

When the preview is valid, Save uses the signed-in browser client, in order:

1. Insert `courses` through `draftCourseInsert`: trimmed title and description, the chosen level, optional `category_id`, `instructor_id` of the session user, and `status` `draft`. Do not send `id` or `created_at`.
2. Insert each lesson for that new `course_id`.
3. Insert each assignment for that `course_id`.

These are separate inserts. They are not one transaction. Save does not send a second course insert while one save is running.

- **Course insert fails.** Show the database error. Do not show a created course.
- **A later lesson or assignment insert fails.** Stop. Do not insert the remaining rows. Show the database error and the course that was created: its title, the Draft badge, and links to that course’s lessons and assignments. The copy says the draft was created, saving stopped before every row was added, and the course is still a draft. Save and Generate stay disabled so a second course is not created by retrying. The instructor finishes the draft on those existing screens.
- **Success.** Show the success banner “This course was saved as a draft.” Dismissing it does not undo the save or leave the page. Also show the new draft and the lessons link. The course stays `draft`. The instructor still submits it from My Courses after it has a lesson.

Save does not set `pending`, publish, archive, enroll anyone, or grade anything.

## Security checks

- **Role.** A student or admin token is rejected before any model call. The instructor layout still redirects other roles away from this screen.
- **Enrollment.** This screen does not read `enrollments` and does not enroll a student.
- **RLS.** The function uses the publishable key and the caller’s bearer token. It does not use the service-role client. Inserts use the signed-in browser client, so `courses_insert_instructor`, `lessons_insert_instructor`, and `assignments_write_instructor` still apply.
- **Secrets.** `GEMINI_API_KEY` stays in the function environment. A missing key returns “AI is not configured.” Responses do not include the key, an upstream body, or a `VITE_` variable.
- **Draft-only saving.** The course insert’s `status` is `draft`. The payload does not send `pending`, `published`, or `archived`. A failed validation does not insert. A later insert failure still leaves that course as `draft` and shows it.

## Acceptance criteria

- Generate shows an editable preview and does not insert a row.
- A blank brief, a missing level, a blank title, a description over 2,000 characters, a blank lesson, or a blank assignment does not insert.
- Save creates one `draft` owned by that instructor, then its lessons and assignments, and does not set `pending`.
- If a lesson or assignment insert fails, the screen shows the database error and that draft, with links to its lessons and assignments, and does not start another course insert.
- Discard preview does not insert or delete.
- A student or admin does not get this screen, and their token cannot use `ai-course-builder`.
- A failed generate shows the error and does not invent a saved course.
