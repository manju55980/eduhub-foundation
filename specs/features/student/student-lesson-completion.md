# Student lesson completion

Specifies how an enrolled student finishes lessons and how that updates `enrollments.progress`. The learning view stays in `student-browse-courses.md`. The My Courses list stays in `student-my-courses.md`. Certificates and notifications stay in `student-certificates-and-notifications.md`. Roles and the route map stay in `product.md`. Columns and the planned migration stay in `architecture.md`.

This feature adds `lesson_completions` and `sync_enrollment_progress`. It does not add a route or a sidebar item. The migration `supabase/migrations/20261016220000_lesson_completions.sql` is on the linked database. Chrome confirmed Mark complete, progress 100, and status `completed`. See `assessment-2/assessment-2-gap.md`.

## Route

The control is on `/student/my-courses/$courseId`, on each lesson of a course the student is enrolled in. The heading, lesson order, video link, and study companion stay as they are. The back link follows `from`, as specified in `student-browse-courses.md`.

## Completion

A lesson is finished only when this student inserts one `lesson_completions` row for it. Opening the learning view does not insert a row. Submitting an assignment does not insert a row.

The insert sends only:

| Column       | Value                                      |
| ------------ | ------------------------------------------ |
| `student_id` | The signed-in user. Not collected.         |
| `lesson_id`  | The lesson on that row.                    |

Do not send `id` or `created_at`. The unique pair (`student_id`, `lesson_id`) allows one completion. A lesson that already has this student’s row shows Completed and has no Mark complete control.

Read and insert with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The call lives in `features/student/`. Do not use the service-role client. Do not update `enrollments` from the browser.

## Progress

`sync_enrollment_progress(student_id, course_id)` is security definer with an empty `search_path`. Revoke execute from `public`, `anon`, and `authenticated`. It counts lessons in the course and this student’s completions whose lesson still belongs to that course.

- No lessons: set `progress` to `0`.
- Otherwise: set `progress` to `floor(completed count × 100 / lesson count)`.

One of three lessons is 33. Three of three is 100. The function updates `enrollments.progress` only, and only when the stored integer would change. `enrollments_sync_status` still sets `completed` at 100 and `active` otherwise.

An after-insert trigger on `lesson_completions` calls the function for that student and that lesson’s course. An after-insert trigger on `lessons` calls it for every enrollment in the new lesson’s course. That lesson insert is allowed only while the course is `draft`, as specified in `../instructor/instructor-course-materials.md`. A published course cannot gain a lesson, so a completed enrollment is not moved back to `active` by a new lesson. Editing a lesson’s title, content, video URL, or order does not delete completions and does not by itself recalculate progress. Those edits are also rejected once the course leaves `draft`.

Existing enrollments stay at their stored progress until one of those triggers runs. Do not backfill completion rows.

## RLS

Do not alter `lessons_select`, `enrollments_select`, `enrollments_insert_student`, `enrollments_update_instructor`, or `enrollments_sync_status`. The content freeze may narrow lesson insert and update. It does not narrow `lessons_select`.

`lesson_completions` has no update grant and no delete grant.

| Action | Rule                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select | An admin reads every row. A student reads rows whose `student_id` is the session user. An instructor reads rows for a lesson whose course `is_course_owner` accepts.     |
| Insert | A student may insert only when `student_id` is the session user and `is_enrolled` is true for that lesson’s course. A security-definer helper does the lesson lookup so the policy does not recurse into `lessons`. |

A student cannot complete a lesson for another student, or a lesson in a course they have not joined. An instructor or admin token cannot insert.

## UI

Follow the visual direction in `product.md`.

- **Not enrolled.** No lesson list, no progress summary, and no Mark complete control, as `student-browse-courses.md` already specifies.
- **Ready.** When the course has at least one lesson, the summary above the list reads “{completed} of {lesson count} lessons complete” and the stored `enrollments.progress` as a percentage. Completed is the number of listed lessons that have this student’s completion row. The meter width is that stored percentage. It does not animate. Each unfinished lesson has Mark complete. Each finished lesson shows Completed.
- **No lessons.** The empty lesson list stays empty. There is no progress summary, no Mark complete control, and no certificate.
- **Submitting.** The control that was used does not send a second insert.
- **Saved.** Stay on the learning view. That lesson shows Completed and counts toward the summary. Re-read `enrollments.progress` and show that stored percentage. Do not write the column. The banner says “This lesson is complete.” It can be dismissed. Dismissing it does not undo the completion or change the route. A failed re-read shows the error and leaves the previous percentage in place.
- **Error.** Show the database error inline. Do not show the lesson as complete.

My Courses shows the same completion count, stored percentage, and meter on each enrolled card. A course with no lessons still shows “0 of 0 lessons complete” and a meter at the stored percentage. My Courses does not offer a progress control and does not list lesson titles.

## Out of scope

- Certificates, notification copy, and assignment reminders. Those are in `student-certificates-and-notifications.md`.
- Uncomplete, unenroll, and deleting a lesson or a completion.
- An animated progress tracker. The summary meter does not animate and is not a chart.
- Changing assignment, grade, publish, or archive behavior.

## Acceptance criteria

- An enrolled student can mark one of their lessons complete once. A second insert is rejected by the unique pair.
- A student who is not enrolled cannot insert a completion, and the learning view does not offer the control.
- Progress is 0 when the course has no lessons, 33 when 1 of 3 lessons is complete, and 100 when every current lesson is complete.
- Status becomes `completed` only at progress 100, through the existing trigger.
- A lesson insert that the content freeze allows recalculates every enrollment in that course. A published course rejects that insert, so a completed enrollment stays `completed`.
- Editing lesson text does not remove a completion.
- The browser does not write `enrollments.progress`. Existing enrollment policies are unchanged.
- An enrolled course with lessons shows the completion count and the stored progress percentage. A course with no lessons has no summary. The meter is not animated.
- After a successful completion, the summary includes that lesson and the re-read `enrollments.progress`. The browser still does not write that column.
- `from=my-courses` returns to My Courses. `from=assistant` returns to Learning Assistant. A missing or other `from` returns to Browse Courses.
- An instructor or admin does not get Mark complete.
