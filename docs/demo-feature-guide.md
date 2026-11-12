# EduHub demo feature guide

Live app: [https://eduhub-foundation.vercel.app/](https://eduhub-foundation.vercel.app/)

EduHub is a learning management system with three roles. An instructor drafts a course. An admin publishes it. A student enrols, studies, submits work, and can finish the course with a certificate. AI, email, and a student CRM sit on that path. This guide lists what each role can do, then every third-party service, then what is not in the product so a demo does not claim it.

Sign-in is email and password, or Google through Supabase Auth. A new account is always a student. An admin promotes a student to instructor. The first admin is set in Supabase. There is no in-app way to become an admin, to demote someone, or to pick a role at signup.

| Role       | Home               | How they get the role                 |
| ---------- | ------------------ | ------------------------------------- |
| Student    | `/student/courses` | Default for every new account         |
| Instructor | `/instructor`      | An admin promotes an existing student |
| Admin      | `/admin`           | Set manually in Supabase              |

## Shared shell

Every signed-in role uses the same workspace.

- Sidebar shows only that role’s pages. The active item stays highlighted on child routes. Below the `md` breakpoint the menu is an overlay.
- Header shows the signed-in name, email, and role. The avatar opens Edit Profile. A light and dark control sits beside the notification bell. Log out is on the right.
- Profile edits `full_name`, `email` (the profile field), and `phone`. A blank phone is stored as null. The person cannot change `role`. Saving the profile does not change the Supabase Auth sign-in email. A student profile save can also refresh the HubSpot contact.
- The bell lists in-app notices for that person: course completion, and assignment reminders. It does not grade, approve, or send email.
- Loading, empty, and error states use one shared treatment. A successful save is a dismissible banner. Dismissing it does not undo the action.

## Course lifecycle

A course is `draft`, `pending`, `published`, or `archived`.

1. The instructor creates a draft by hand or with the AI Course Builder. Level is beginner, intermediate, or advanced. Category is optional.
2. While the course is a draft, the owner can edit the title, description, level, and category, and can add lessons, assignments, and files.
3. Submit for approval requires at least one lesson on My Courses. Status becomes `pending`. Course fields, lessons, assignments, and materials then freeze. The database does not itself count lessons.
4. An admin may run an advisory AI review. `recommend` and `revise` do not change status. Confidence below 0.70 is labelled low confidence. Approve stays available. A failed review does not hide Approve.
5. Publish is a separate admin action and is the only way a course becomes `published`.
6. Archive hides a published course from new enrolments. Students already enrolled keep the course, lessons, assignments, and files.
7. There is no reject action and no restore-from-archive action. Rows are not hard-deleted, except an unused category.

A student can enrol in a published course once. Progress starts at 0 and status is `active`. Progress is the share of that course’s lessons the student has marked complete. It becomes 100 only when every lesson is complete, and status then becomes `completed`. Submissions do not change progress. The student cannot write progress directly. The first completion issues one certificate and notifies the student and the owning instructor.

## Student

Sidebar: Browse Courses, My Courses, Learning Assistant, Assignments, Calendar, My Grades, My Certificates.

Profile is opened from the header, at `/student/profile`.

### Browse Courses — `/student/courses`

Lists published courses. Filter by category. Open a course at `/student/courses/$courseId`. Enrol once. An archived course is not offered to someone who is not already enrolled.

### My Courses — `/student/my-courses`

Courses this student has joined, with progress. Open one at `/student/my-courses/$courseId`. A finished course shows a certificate on the card.

### Enrolled course

- Lesson list and lesson content.
- Mark each lesson complete once. The screen shows how many lessons are done and the stored progress. It is not a chart.
- Course files the instructor attached, as a short-lived download link. The bucket is private.
- Assignments for that course.
- Study Companion, described under AI.

### Learning Assistant — `/student/assistant`

A chat for catalogue help. The page calls the `ai-agent` Edge Function. Only a student continues. The browser sends the recent messages and reads back text, matching courses, and whether an enrolment just happened.

One message is a supervisor plus one specialist. The transcript is not stored. Leaving the page drops it. Shared memory lasts for that one request: the latest 8 messages (1,000 characters each), the supervisor task, tool results, and course ids those tools returned.

| Agent                | What it is for                                                                                                           | Tools                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Supervisor           | Chooses a specialist and a task. It does not call tools. Confidence below 0.7 on an enrolment route does not run a tool. | None                                                                                            |
| Tutor                | Explains or finds a course                                                                                               | `search_catalogue`, `describe_course`                                                           |
| Advisor              | Recommends and counts                                                                                                    | `latest_published_course`, `search_catalogue`, `suggest_next_course`, `count_published_courses` |
| Enrolment specialist | Acts on the student’s own record                                                                                         | `enrol_in_course`, `fetch_my_grades`, `describe_course`                                         |

Demo questions that match the tools:

- “How many published courses are there?” uses the count tool, not the search hit list.
- “What is the latest published course?” or “newest Technology course” uses the latest-published lookup. A word such as “tech” can match a category name such as Technology.
- “Recommend a next course” uses the suggestion tool.
- “Enrol me in …” runs only when the latest message asks to enrol or join, and only for a published course.
- “What are my grades?” reads this student’s grades.

Catalogue search embeds the question with Ollama `nomic-embed-text` (768 dimensions) and calls `match_knowledge` over `rag_chunks`. If that embed host is down, search stops and the student sees “The AI request failed.” Other tools that do not embed can still answer. Guardrails redact email and phone patterns and wrap untrusted text. The model is `gemini-3.5-flash-lite`. Each Gemini call waits up to 45 seconds.

### Study Companion

On an enrolled course that has lesson content. One question returns an explanation, an example, and practice questions. Nothing is saved. Practice questions are not inserted into assignments. This is a separate `ai-study` call, not the Learning Assistant.

### Assignments — `/student/assignments`

Work for courses the student has joined. Submit once, as text or as a link in `content_url`. It is not a file upload. Status becomes `submitted`. A stored due date can produce in-app reminders. Submitting does not change lesson progress.

### Calendar — `/student/calendar`

Month, week, and day. Week starts on Monday. The student sees class meetings for enrolled courses and assignment deadlines in the visible range. A class opens the enrolled course. A deadline opens Assignments. There is no add or edit control. Google Calendar is not connected.

### My Grades — `/student/grades`

This student’s grades and instructor feedback only. Another student’s grades are not readable here.

### My Certificates — `/student/certificates`

One certificate per finished course, newest first. Open it at `/student/certificates/$certificateId`. The document shows the course and the completion date. Download PDF and print use forest green on warm paper and do not follow the dark theme. The certificate is issued by the database when progress first hits 100. The student cannot mint one by hand.

## Instructor

Sidebar: Instructor Dashboard, Create Course, AI Course Builder, My Courses, Calendar, Submissions.

Profile is `/instructor/profile`.

### Instructor Dashboard — `/instructor`

Greets the instructor by name, or “Instructor” when the name is blank. Lists every submission still waiting to be graded, and the four newest courses. It does not grade from this page.

### Create Course — `/instructor/courses/new`

Title, description, level, and an optional category. Save creates a `draft`. The course is not in the student catalogue.

### AI Course Builder — `/instructor/courses/generate`

The instructor writes a short brief, picks a level, and chooses how many lessons and assignments to generate. The preview shows the outline, lessons, assignment questions, and any YouTube video suggestions. The instructor can edit the preview. Save validates it, then inserts one new `draft` course, then lesson rows, then assignment rows. Those inserts are separate statements. If a later insert fails, the draft stays and the screen points at that course so the instructor can finish it on the lesson and assignment screens. Save does not submit the course for approval. Video suggestions need `YOUTUBE_API_KEY`. Without that key the preview still returns. Without `GEMINI_API_KEY` the screen says AI is not configured.

### My Courses — `/instructor/courses`

This instructor’s courses. Open one at `/instructor/courses/$courseId`.

- Lessons: `/instructor/courses/$courseId/lessons`. Add and edit while the course is a draft.
- Materials: `/instructor/courses/$courseId/materials`. Upload while the course is a draft.
- Assignments: `/instructor/courses/$courseId/assignments`. Create and edit while the course is a draft. A due date is optional.
- Submit for approval from My Courses once the draft has a lesson.

Allowed material types are PDF, DOCX, PPTX, TXT, PNG, and JPEG, at most 20 MB. Files live in the private bucket `course-materials`. The owner and an admin can read them. A student can read them only after enrolling. Download links last 60 seconds. There is no delete. A wrong file stays until a later decision adds one.

After submit, the owner cannot change the course fields, lessons, assignments, or materials.

### Calendar — `/instructor/calendar`

Same month, week, and day views. Shows class meetings for courses this instructor owns, and assignment deadlines on those courses. Add class and Edit class: course, title, start, end, and an optional location. End must be after start. Edit cannot move the meeting to another course. There is no delete. Students only see meetings for courses they have joined, through row policies. This calendar does not sync to Google.

Class meetings need the `class_sessions` table on the database. The migration is in the repository. If that migration has not been applied, Add class will fail even though the screen is in the app.

### Submissions — `/instructor/submissions`

Review submitted work for courses this instructor owns. Record a whole-number grade from 1 to 10 and feedback. Status becomes `graded`. The stored grade column is text. The form only accepts that 1–10 range. An admin can read grades and cannot change them.

A completion notice for a course this instructor owns appears in the header bell. The instructor does not mark a student’s lesson complete and does not issue a certificate by hand.

## Admin

Sidebar: Admin Dashboard, Manage Courses, Manage Users, Manage Categories, All Enrollments, Campaigns, Reports.

There is no admin profile page in the sidebar and no admin calendar.

### Admin Dashboard — `/admin`

Greets the admin by name, or “Admin” when the name is blank. Lists every course waiting for approval and the four newest enrolments. It does not approve from this page.

### Manage Courses — `/admin/courses`

Every course, with search and filters. Open one at `/admin/courses/$courseId`. From here the admin reaches approvals and archive. The admin does not edit course content.

### Approve Courses — `/admin/courses/approvals`

Pending courses. Run the advisory AI review (`ai-course-review`). The stored review is `recommend` or `revise`, with a confidence from 0 to 1. Below 0.7 the label is “Low confidence” and Approve stays available. Publish is the existing status update and is the only publish path.

### Archive Courses — `/admin/courses/archive`

Published courses. Archive hides the course from new enrolments. Existing students keep access.

### Manage Users — `/admin/users`

Every profile, with search. Promote another student to instructor through `promote_student_to_instructor`. No other role change is available. The admin cannot promote themselves through this screen into a new role, and cannot create another admin here.

### Manage Categories — `/admin/categories`

Create, rename, and delete a category. A category has a name and a created time. The name is unique after trim. A category that any course still uses cannot be deleted. An unused category is the only hard delete in the product. Instructors pick a category on create and on a draft. Students filter the catalogue by it.

### All Enrollments — `/admin/enrollments`

Every enrolment. Search by course or student. Progress and status are visible. Grades can be read. Grades cannot be changed.

### Reports — `/admin/reports`

Every enrolment, newest first: course, student, progress, and status. Search matches the course title or student name already loaded. It does not add a new query, and it does not draw charts. The course cell opens that course’s details page.

### Campaigns — `/admin/campaigns`

Re-engagement email for students.

| Segment  | Who is in it             |
| -------- | ------------------------ |
| New      | Registered within 7 days |
| Active   | Learned within 30 days   |
| Inactive | Everyone else            |

The admin picks a segment, writes a subject (180 characters) and a message (4,000 characters), previews the audience, then sends. Send stays disabled until the preview matches the current draft and the count is not zero. The preview shows the count and a sample of names. The history table tracks sent, opened, bounced, and re-enrolled. Delivery uses the same email provider as enrolment and certificate mail. A preview does not send.

## Third-party integrations

Secrets for Edge Functions are set with `supabase secrets set`. They are not `VITE_` variables and they are not in git. The browser only receives `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and, when used, `VITE_SENTRY_DSN`.

| Service                 | Direction                | What it does in EduHub                                                                                                                                                                                                                                                | Where it shows up                               |
| ----------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Supabase Auth           | Inbound sign-in          | Email and password, and Google sign-in. Session JWT on every query.                                                                                                                                                                                                   | `/auth`                                         |
| Supabase Postgres       | Data                     | Courses, lessons, enrolments, assignments, submissions, profiles, categories, materials metadata, certificates, notifications, RAG chunks, campaigns. Row-level security is the access boundary.                                                                      | Every role                                      |
| Supabase Storage        | Files                    | Private bucket `course-materials`.                                                                                                                                                                                                                                    | Instructor materials, student course page       |
| Supabase Edge Functions | Server                   | `ai-agent`, `ai-study`, `ai-course-builder`, `ai-course-review`, `student-email`, `admin-campaign`, `resend-webhook`.                                                                                                                                                 | AI, email, campaigns                            |
| Google (Supabase Auth)  | Sign-in only             | OAuth for login. This is not Google Calendar.                                                                                                                                                                                                                         | Sign-in                                         |
| Google Gemini           | Outbound                 | Chat model `gemini-3.5-flash-lite` for Study Companion, Course Builder, course review, and the Learning Assistant. Secret `GEMINI_API_KEY`.                                                                                                                           | Student and instructor AI, admin review         |
| YouTube Data API        | Outbound                 | Optional video suggestions inside a generated course preview. Secret `YOUTUBE_API_KEY`. A missing key still returns the outline.                                                                                                                                      | AI Course Builder                               |
| Ollama                  | Outbound embeddings      | `nomic-embed-text` at 768 dimensions for catalogue search and for the RAG corpus. The function reads `OLLAMA_HOST` and posts to `/api/embed`. The same machine can run `llama3.2` for the offline level-classifier comparison. The assistant chat model stays Gemini. | Learning Assistant search                       |
| Cloudflare quick tunnel | Temporary bridge         | Publishes local Ollama so the deployed function can embed a query. The URL changes every time the tunnel starts and must be copied into `OLLAMA_HOST`. It is not a product feature and it is not stored in the repo.                                                  | Only while a demo needs live catalogue search   |
| Resend                  | Outbound email           | Enrolment email and certificate email from `student-email`. Certificate email is sent only after the course is completed. Campaign mail uses the same provider. Secrets `RESEND_API_KEY` and `RESEND_FROM`.                                                           | After enrol, after completion, admin campaigns  |
| Resend webhooks (Svix)  | Inbound                  | `resend-webhook` checks the signature and records opened and failed delivery. `verify_jwt` is false only on this function. Secret `RESEND_WEBHOOK_SECRET`. Signature window is 5 minutes.                                                                             | Campaign opened and bounced counts              |
| SMTP2GO                 | Alternate outbound email | Used only when `EMAIL_PROVIDER` is `smtp2go`, with `SMTP2GO_API_KEY` and `EMAIL_FROM`. It is not the default provider.                                                                                                                                                | Same enrolment, certificate, and campaign sends |
| HubSpot                 | Outbound CRM             | Upserts a contact when a student enrols, and when a student saves their profile. Secret `HUBSPOT_ACCESS_TOKEN`.                                                                                                                                                       | No separate HubSpot screen                      |
| Sentry                  | Outbound errors          | Browser (`VITE_SENTRY_DSN`), the Vercel server, and Edge Functions (`SENTRY_DSN`). Events omit prompts, cookies, headers, and request bodies. Nothing is sent when the DSN is unset.                                                                                  | Background                                      |
| Vercel                  | Hosting                  | The published app is a Node server.                                                                                                                                                                                                                                   | The live URL                                    |
| GitHub Actions          | CI                       | On push and pull request: lint, TypeScript, the Vitest suite, and the production build. Node.js 22.                                                                                                                                                                   | Repository                                      |
| Lovable cron            | Inbound job              | `POST /api/assignment-reminders` every hour (`0 * * * *` UTC) with a bearer matching `LOVABLE_CRON_SECRET` or `LOVABLE_CRON_SECRET_PREVIOUS`.                                                                                                                         | In-app “Assignment due soon” notices            |

### Email and CRM, in the order a demo hits them

1. Student enrols. The app calls `student-email` with action `enrolment`. That sends the enrolment email and can upsert the HubSpot contact.
2. Student finishes every lesson. The app calls `student-email` with action `completion`. The certificate email goes out only because the course is completed. The in-app certificate and the header notices are separate and do not depend on the email provider.
3. Student saves their profile. Action `profile` refreshes the HubSpot contact. It does not send a campaign.
4. Admin previews and sends a campaign. `admin-campaign` sends through the same provider and stores sent, opened, bounced, and re-enrolled.
5. Resend calls `resend-webhook`. A valid signature updates delivery. An invalid signature is rejected.

Do not read a from-address out of this document. The sender is whatever `RESEND_FROM` or `EMAIL_FROM` is set to in the project secrets.

### Assignment reminders

The hourly job looks at assignments due within 72 hours for enrolled students who have not submitted. It inserts one in-app notice per stage:

| Stage | When it is due                               |
| ----- | -------------------------------------------- |
| 72h   | More than 24 hours away, and within 72 hours |
| 24h   | More than 1 hour away, and within 24 hours   |
| 1h    | Within the next hour                         |

The title is “Assignment due soon”. A second run does not insert a duplicate for the same assignment, student, stage, and due date. The job uses the service role. A missing or wrong bearer returns 401. GET returns 405. These reminders are in-app, not email.

### RAG corpus

`rag_chunks` holds 5,040 embedded chunks: 9 course, 31 lesson, and 5,000 FAQ. Embeddings are Ollama `nomic-embed-text`. Assessment 2 retrieval on that corpus:

| Set                           | Queries | Hit@5 | MRR@5 | Mean top-1 cosine |
| ----------------------------- | ------: | ----: | ----: | ----------------: |
| Matching                      |      30 | 1.000 | 0.950 |             0.888 |
| Noisy                         |      30 | 0.867 | 0.291 |             0.841 |
| Extreme, with an expected key |      15 | 0.133 | 0.080 |             0.820 |
| Extreme, out of corpus        |      15 |     — |     — |             0.493 |

Out-of-corpus queries are rejected at cosine 0.75. Hybrid search, re-ranking, faithfulness, and answer relevance are not built. Those figures are the Assessment 2 baseline.

### Level classifier

An offline script, not a page. Gemini `gemini-3.5-flash-lite` and local Ollama `llama3.2` each classified the same 40 held-out courses (160 train). Accuracy, macro precision, macro recall, and macro F1 are 1.000 for both, above the 0.85 target. The script does not change `courses.level`. No fine-tuned model is wired into the assistant.

### AI rate limits

The repository migration sets hourly caps: Study Companion 30, Learning Assistant 20, Course Builder 10, course review 10. The handlers call `consume_ai_request` and fail closed when that database function is missing, which means they do not call Gemini. Confirm the migration is applied before an AI demo. If it is not, the student sees a failure instead of an answer.

## Security boundaries worth saying out loud

- Queries and enrolment inserts use the signed-in JWT, so row policies apply.
- A student cannot read another student’s grades, certificates, notifications, or submissions.
- An instructor sees submissions and materials only for courses they own.
- An admin can read broadly and cannot change a grade or edit course content.
- Signup metadata cannot set a role. A trigger creates the profile as `student`.
- The service role is limited to the reminder job and to server-side integration writes. It is not in the browser.
- AI prompts and request bodies are not sent to Sentry.
- The public Cloudflare tunnel, when used, exposes whatever is behind it. The intended temporary setup forwards only `POST /api/embed`. Tunnelling Ollama itself also exposes the rest of the local Ollama API until the tunnel stops.

## demo order

About five to eight minutes. Use one course that is already published, with at least one lesson, one assignment, and one file, and one student who is not yet enrolled in it.

1. Landing page. Point at the three role cards and the create, publish, enrol, submit, grade path.
2. Student. Browse, filter by category, open the course, enrol. Mention the enrolment email and the HubSpot contact.
3. Student. Open the enrolled course, mark a lesson if you want progress on screen, and ask the Study Companion one question. Show the explanation, example, and practice questions, and say the answer is not saved.
4. Student. Open Learning Assistant. Ask for the number of published courses, then the latest course in a category, then “enrol me in …” only if you want a second enrolment. If catalogue search is in the script, start Ollama and the tunnel first and set `OLLAMA_HOST` to that run’s URL.
5. Student. Submit the assignment once as text or a link.
6. Instructor. Dashboard queue, open Submissions, enter a grade from 1 to 10 and feedback.
7. Student. My Grades shows that grade. If you have a finished course, open My Certificates and download the PDF.
8. Instructor, if time. AI Course Builder: generate, edit the preview, save a draft, and show it under My Courses as draft, not published. Or add a class on the instructor calendar and show it on the student calendar.
9. Admin. Approvals: show a pending course, optional AI review, then Approve. Or Archive, and say existing students keep access.
10. Admin. Campaigns: choose Inactive, write a subject and message, preview the count, and send only if you intend a real email. Otherwise stop on the preview and show the sent, opened, bounced, and re-enrolled columns.
11. Header bell. Completion notice or “Assignment due soon”, if one exists for the account.

## Do not claim these in the demo

- Google Calendar sync, personal Google import, or a push webhook. The calendar is inside EduHub only.
- A chat transcript that survives refresh.
- Hybrid RAG, re-ranking, citations, faithfulness, or answer relevance.
- A fine-tuned model inside the assistant. Ollama in the live assistant is the embedding model.
- Stripe, Slack, or any payment flow.
- Rejecting a pending course, restoring an archived course, or deleting a course file.
- Creating another admin, or any role change besides student to instructor.
- That the public tunnel URL is stable. It changes when `cloudflared` restarts.
