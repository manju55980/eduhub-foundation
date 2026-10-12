# Instructor grading

Specifies how an instructor reviews submissions for their own courses and records a grade and feedback. Assignment authoring stays in `instructor-assignment-management.md`. Student submission stays in `../student/student-assignment-submission.md`. The student’s grade view is specified in `../student/student-my-grades.md` and is not this feature. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

## Route

`/instructor/submissions` is Submissions (grading). The heading is “Submissions (grading)”. It is a sidebar item, so it has no back link. The existing file route stays in place. Do not add a submission-detail route. Each submission is a card.

## Schema and RLS

The submission table, its grants, and its policies already support grading. Do not add a column, a grade scale, a status trigger, or a change to `submissions`.

| Need                               | What already exists                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read submissions for owned courses | `submissions_select` lets an instructor read a submission when `is_course_owner` is true for that assignment’s course. Another instructor’s submissions are not returned. An admin can read them, but this screen is instructor-only. |
| Read the student’s text or link    | `content_url` is selectable. It is not in the update grant, so a grade save cannot change it.                                                                                                                                         |
| Write a grade and feedback         | The update grant is `grade`, `feedback`, and `status` only. `submissions_update_instructor` allows that update only for the owning instructor. `grade` is text. No scale is defined.                                                  |
| Mark the submission graded         | `status` allows `submitted` or `graded`. This screen sends `graded`.                                                                                                                                                                  |
| No delete                          | There is no delete grant.                                                                                                                                                                                                             |

`profiles_select_own` lets a user read only their own profile. `profiles_select_admin` lets an admin read every profile. An instructor cannot read the student who submitted. That is the gap.

Add one select policy in a new migration. Do not edit the applied migrations.

`profiles_select_instructor_submission`: an instructor can select a profile only when that profile has a `submissions` row whose assignment belongs to a course `is_course_owner` accepts. Use the existing security-definer helper so the check does not subquery `courses` under RLS. Do not add a column, and do not change the table select grant.

This screen requests only `id` and `full_name`. It does not request `email`, `phone`, or `role`. The table select grant still allows those columns for a row the new policy returns. This feature does not narrow that grant.

No other policy change. Do not add a trigger that blocks `graded` from being saved again. The existing update policy already allows the owning instructor to write the grade columns more than once.

## Listing

Read with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The query lives in `features/instructor/`. Do not use the service-role client.

List the submissions this instructor can read. Then read each submission’s assignment `title`, that assignment’s course `title`, and the student’s `full_name`.

Order by the submission `created_at` descending. Do not add search, filters, pagination, or another instructor’s submissions. The two views below are a split of this list. They do not add a query.

If the submission query, assignment query, course query, or profile query fails, show that error and do not offer save. Do not show the views. An empty submission list is an empty state, not sample submissions. It has no save control.

A submission row is still shown when its assignment, course, or profile row is missing. A missing or null title or name is blank. Do not invent one.

## Views

`/instructor/submissions` has two views. Do not add a route for either view. The default view is To Grade.

| View     | Submissions shown                                   |
| -------- | --------------------------------------------------- |
| To Grade | `status` is `submitted`, newest `created_at` first. |
| Graded   | `status` is `graded`, newest `created_at` first.    |

Switching views does not run another query and does not change a submission.

After a successful save, that submission’s status is `graded`, so it leaves To Grade and appears in Graded with the saved grade and feedback. The screen stays on the view that was open. The instructor opens Graded to review it.

A graded submission stays in Graded when its grade or feedback is saved again. Its grade and feedback stay editable. There is no control that returns it to To Grade.

Each view has its own empty state and no save control when it has no cards. To Grade says “No submissions to grade.” Graded says “No graded submissions.”

## Submission details

Each card shows the stored assignment title, course title, student `full_name`, `content_url`, submission `status`, and submission `created_at`. A null value is shown blank.

`content_url` is the submitted text or link. It is read-only. Do not show another student’s submission on the same card. Do not show lessons.

The grade and feedback fields show the stored values. A null grade or feedback is an empty field.

## Grade

Save sends only:

| Column     | Value                                                               |
| ---------- | ------------------------------------------------------------------- |
| `grade`    | Required. Trimmed text. Reject blank. No scale and no number check. |
| `feedback` | Optional. Trimmed text, or null when blank.                         |
| `status`   | `graded`. Not collected from a status control.                      |

Do not send `content_url`, `assignment_id`, `student_id`, `id`, or `created_at`. Do not send `submitted`.

The same form is used in To Grade and in Graded. Saving a graded row again updates the grade and feedback and still sends `status: "graded"`. There is no control that returns a submission to `submitted`.

Saving does not create a submission, assignment, lesson, or enrollment.

There is no delete control.

## UI

Follow the visual direction in `product.md`. Use `PageHeader`, the existing tabs, white bordered cards, and the existing button, input, and textarea primitives.

- **Loading.** The views are not shown yet. Do not offer save and do not show sample submissions.
- **Ready.** To Grade is selected. It lists `submitted` rows, or “No submissions to grade.” Graded lists `graded` rows, or “No graded submissions.” Each card has Save grade.
- **Submitting.** The Save grade control that was used does not send a second update.
- **Graded.** Stay on this screen and on the view that was open. The saved submission is in Graded, with status Graded and the saved grade and feedback. The banner says “This submission was graded.” It can be dismissed. Dismissing it does not change the grade back, move the submission, or change the route.
- **Error.** Show the Supabase or form error inline. An error replaces the success banner. Leave the entered grade and feedback in place. A failed save leaves the submission in the view it was in.

No second visual system. No file upload and no grading scale on this screen.

## Authorization

The instructor layout already calls `requireRole("instructor")`. A student or admin is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`. Regenerate it after the new policy is applied.

## Out of scope

- The student grade page. That is specified in `../student/student-my-grades.md`.
- Creating submissions, assignments, or lessons.
- Changing `content_url`, or returning a submission to `submitted`.
- Enrollment progress.
- Admin grade reading. Admins can already select submissions; this screen does not give them a grading form.
- Narrowing which profile columns the select grant exposes.
- Categories, dashboards, and reports.

## Acceptance criteria

- An instructor sees submissions only for courses they own, newest submission `created_at` first.
- To Grade lists `submitted` rows. Graded lists `graded` rows. The page opens on To Grade.
- Each card shows the stored assignment title, course title, student name, submitted text or link, status, and created time. A null or missing related name is blank.
- Save updates only `grade`, `feedback`, and `status`. Status is `graded`. Grade is trimmed text and is rejected when blank. A blank feedback is stored as null.
- After a successful save, that submission leaves To Grade and appears in Graded. The screen stays on the open view.
- A past or missing due date is not part of this screen. The submitted text stays read-only.
- A graded submission can be reviewed and saved again from Graded. The screen does not send `submitted` and has no delete control.
- An empty view has no sample submissions and no save control.
- A failed submission, assignment, course, or profile load shows the error and does not offer save.
- A failed save shows the database error, leaves the entered grade and feedback in place, and leaves the submission in its current view.
- The only schema change is `profiles_select_instructor_submission`. No column, grade scale, or status trigger is added.
- A student or admin does not get this screen.
