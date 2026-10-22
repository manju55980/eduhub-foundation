# Certificates and notifications

Specifies the certificate issued when a course is first completed, and the in-app notifications for that event and for an upcoming assignment. Lesson completion stays in `student-lesson-completion.md`. Roles and the route map stay in `product.md`. Columns and the planned migration stay in `architecture.md`.

This feature adds `certificates` and `notifications`. My Certificates is the student sidebar item for `/student/certificates`. One certificate opens at `/student/certificates/$certificateId` and has no separate sidebar item. Notifications still have no sidebar item. The migration `supabase/migrations/20261016221000_certificates_and_notifications.sql` is on the linked database. There is no email send. Chrome confirmed the certificate sentence, both completion notices, and Mark read. The reminder endpoint is implemented. The hourly schedule is confirmed, and both automations work. See `assessment-2-gap.md`.

The completion rows are inserted by `enrollments_issue_certificate` when `enrollments.status` changes to `completed`. That trigger is already in the migration. Assignment reminders are inserted by `POST /api/assignment-reminders`. The browser does not call that path.

## When a certificate is issued

The lesson-completion function updates `enrollments.progress`. The existing `enrollments_sync_status` trigger sets `status`. An after-update trigger on `enrollments` runs only when `status` changes to `completed`.

That trigger is security definer with an empty `search_path`. It inserts:

| Row | Recipient | `kind` | `dedupe_key` |
| --- | --------- | ------ | ------------ |
| Certificate | The enrollment’s student and course | — | One row per `enrollment_id` |
| Notification | The student | `course_completed` | `course_completed:{enrollment_id}` |
| Notification | `courses.instructor_id` | `student_completed_course` | `student_completed_course:{enrollment_id}` |

The student title is “Course complete”. The body names the course title. The instructor title is “A student completed a course”. The body names the course title and does not include the student’s email, phone, or name. Instructors cannot read an arbitrary student profile, and this row must not depend on that.

If the certificate or either notification already exists, the trigger inserts nothing for that row. A later lesson can lower progress and set `status` back to `active`. The certificate and the two notifications stay. Reaching `completed` again does not insert a second certificate or a second pair of notifications.

Authenticated users cannot insert, update, or delete `certificates`. Authenticated users cannot insert or delete `notifications`.

## Assignment reminders

A scheduled job inserts `assignment_due` for each enrolled student at three stages. The windows do not overlap, and each run chooses at most one stage for an assignment:

- **72h.** More than 24 hours remain, and at most 72 hours remain.
- **24h.** More than 1 hour remains, and at most 24 hours remain.
- **1h.** The due date is still ahead, and at most 1 hour remains.

A due date that is null, already past, or more than 72 hours away creates no row. A student with a `submissions` row for that assignment is skipped, including a later stage after they submit. The dedupe key is `assignment_due:{assignment_id}:{student_id}:{stage}:{due_date}`. A stored key blocks only that stage. A changed `due_date` may create a new row because the key includes that timestamp.

The hourly schedule can miss an hour. The next run still sends the stage whose window contains the remaining time, and it does not also insert a stage whose window has already closed. A second run in the same window inserts nothing for that key.

The title is “Assignment due soon”. The body names the assignment title, the course title, and the stage lead time (72 hours, 24 hours, or 1 hour).

The job is `POST /api/assignment-reminders` on the app server. `authenticateCronRequest` allows it only when the `Authorization` bearer matches `LOVABLE_CRON_SECRET` or `LOVABLE_CRON_SECRET_PREVIOUS`. Any other caller receives 401, and a non-POST request from an authorized caller receives 405. The handler then uses the service-role client. The browser never calls it and never sees the service-role key. The job inserts only this kind of notification. It does not grade, enroll, or change progress. A second run inserts nothing for the same assignment, student, stage, and due date because the planner skips a stored dedupe key and the insert uses `on conflict (dedupe_key) do nothing`.

The endpoint is implemented. The hourly schedule is confirmed, and both automations work. The published Lovable worker and Vercel Cron cannot send that POST. Vercel Cron sends GET with `CRON_SECRET`. The hourly caller is an external POST to the published origin (`0 * * * *` UTC) with `Authorization: Bearer <LOVABLE_CRON_SECRET>`, after `LOVABLE_CRON_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are set on the app server runtime. The exact command is in the README. An earlier local POST with no bearer returned 500 and did not run the job. That missing-secret check is not the scheduled run.

## Who can read

| Table | Select |
| ----- | ------ |
| `certificates` | An admin reads every row. A student reads rows whose `student_id` is the session user. An instructor reads rows whose course `is_course_owner` accepts. |
| `notifications` | An admin reads every row. Any other role reads rows whose `recipient_id` is the session user. |

A student marks their own notification read by setting `read_at` to the current time. The update grant is `read_at` only. A guard trigger rejects a change to any other column, a change by someone who is not the recipient, and clearing `read_at`. There is no delete grant on either table.

No admin screen lists every certificate or every notification. Admin select exists so oversight matches enrollments. Do not add that screen here.

## UI

Follow the visual direction in `product.md`. Use the existing banner, empty, and error treatments.

- **My Certificates.** `/student/certificates` lists the signed-in student’s certificate rows whose enrollment `status` is still `completed`. Each card shows the course title, `issued_at` as the completion date, and View Certificate. A blank course title stays blank. The list does not insert, update, or delete a certificate. An empty list says “You have no certificates yet.” A failed query shows that error and does not invent a certificate.
- **Certificate.** `/student/certificates/$certificateId` reads that one row for the signed-in student. It shows a landscape certificate with EduHub, the student’s stored name, the course title, the completion date, the certificate `id`, and an achievement seal. A blank name stays blank. Print uses the browser print dialog. Download PDF saves a landscape PDF of the same fields. A missing row, an enrollment that is not `completed`, or a failed query says “This certificate is not available.” or the query error, and does not offer Print or Download PDF.
- **Learning view.** When the enrollment `status` is `completed` and a certificate row exists, show “Certificate issued” with the course title and `issued_at`. When `status` is `active`, do not show it, even if an older certificate row remains.
- **My Courses.** On a card whose enrollment is `completed` and has a certificate, show the same certificate sentence. This page does not list notifications.
- **Instructor Dashboard.** This page does not list notifications, and it still does not grade a submission.
- **Header bell.** The shared authenticated header shows one bell for the signed-in student, instructor, or admin. It loads that user’s notifications with `listNotifications`, newest `created_at` first. A red badge shows the unread count. The popover lists `title`, `body`, and `created_at`. A null `read_at` has an unread indicator and Mark read. A set `read_at` shows Read. Mark read uses `markNotificationRead` and the badge drops when that row’s `read_at` is set. The query still filters `recipient_id` to the signed-in user, so an admin bell is not a list of every notification.
- **Empty.** No notifications is the sentence “No notifications.” Do not show sample rows.
- **Error.** A failed certificate or notification query shows that error and does not invent a certificate or a notification.

The banner says “Notification marked read.” Dismissing it does not clear `read_at`.

## Out of scope

- Email, push, and a notifications sidebar item.
- Editing or deleting a certificate.
- The RAG corpus and the learning assistant.
- Changing who may read grades or profiles.

## Acceptance criteria

- The first transition of an enrollment to `completed` inserts one certificate, one student notification, and one instructor notification.
- A second transition to `completed` inserts none of those rows.
- The instructor notification has no student email, phone, or name.
- The certificate sentence is visible only while enrollment `status` is `completed`.
- My Certificates lists only those completed certificates. View Certificate opens the stored row. Print and Download PDF do not write a certificate.
- A student reads and marks read only their own notifications. An instructor does not read the student’s `course_completed` row unless they are also that recipient.
- An assignment with no due date creates no reminder. One hourly run can insert the 72h, 24h, and 1h stages for different remaining times, one row per enrolled student who has not submitted. A second run does not duplicate a stored stage. A missed hour still sends the open stage and does not backfill a closed one.
- A student who already submitted that assignment gets no reminder, including a later stage.
- Existing policies on enrollments, lessons, assignments, and submissions are unchanged.
