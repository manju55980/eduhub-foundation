# Architecture

Current shape of the EduHub repository, plus the boundaries for later work. Feature behavior is in `product.md`. Assignment requirements are in `EduHub_Assignment1_Requirements.md`.

## Stack

| Concern                   | Choice                                                               |
| ------------------------- | -------------------------------------------------------------------- |
| UI                        | React 19, TypeScript                                                 |
| App framework             | TanStack Start (Vite)                                                |
| Routing                   | TanStack Router, file-based routes in `src/routes`                   |
| Server data cache         | TanStack Query, provided in `src/routes/__root.tsx`                  |
| Backend                   | Supabase (`@supabase/supabase-js`). Profiles migration is local only |
| Styling                   | Tailwind CSS 4, shadcn/ui (New York, slate, CSS variables, Lucide)   |
| Forms (available, unused) | React Hook Form, Zod                                                 |
| Tests                     | Vitest, Testing Library, jsdom                                       |

`drizzle-orm` and `postgres` are installed. `drizzle/schema.ts` is an empty generated file and is not the data layer. See `guides/supabase.md`.

Package name in `package.json` is still `tanstack_start_ts`. `README.md` documents `npm`. Both `package-lock.json` and `bun.lock` are present.

## What exists today

```text
src/
  routes/__root.tsx          # document shell, QueryClient, 404, error boundary
  routes/index.tsx           # public entry
  routes/auth.tsx            # sign-in and sign-up
  routes/student/            # student shell and sidebar routes
  routes/instructor/         # instructor shell and sidebar routes
  routes/admin/              # admin shell and sidebar routes
  components/app-shell/      # shared frame, sidebar, header
  router.tsx                 # router factory
  start.ts                   # CSRF + Supabase auth header middleware
  server.ts                  # SSR error wrapper
  styles.css                 # semantic tokens, including role soft colors
  components/ui/             # shadcn primitives, unused by routes
  integrations/supabase/     # generated clients; public schema is empty
  lib/                       # cn(), Lovable error helpers
  test/app-routing.test.tsx  # "/" matches a page
```

The public routes are `/` and `/auth`. `/student`, `/instructor`, and `/admin` require a matching `profiles.role`. Their sidebars link to the recorded routes. Instructor Create Course and My Courses load that instructor’s courses and lessons. My Courses submits a draft that has a lesson, which sets `pending`. Browse Courses lists published courses, enrolls the student, and shows lessons after enrollment. Student My Courses lists the courses that student has joined. Approve Courses lists those pending courses and publishes one. Archive Courses lists published courses and archives one. An instructor can create and edit assignments for a course they own. A student can view those assignments, submit once, and read their own grades. An instructor can grade a submission for a course they own. An admin can view every enrollment. A student or instructor can edit their own profile name, email, and phone. Manage Users lists every profile and can promote another student to instructor. Categories load. Reports lists every enrollment and does not repeat sidebar links, counts, or charts. Instructor Dashboard lists submissions waiting to be graded and the four newest courses. It does not repeat sidebar links, counts, or charts, and it does not grade a submission. Admin Dashboard lists courses waiting for approval and the four newest enrollments. It does not repeat sidebar links or show counts or charts. `roadmap.md` still says source changes wait on approval of the original foundation plan. That approval is not recorded.

Supabase client files, env names, and access rules are in `guides/supabase.md`. Routing and UI conventions are in `guides/frontend.md`.

## Request path

Browser routes render through TanStack Start. `src/start.ts` applies:

1. `attachSupabaseAuth` on server functions (client middleware).
2. `errorMiddleware` and CSRF protection on server functions (request middleware).

How to call Supabase from server functions is in `guides/supabase.md`.

## AI

Study Companion and Course Builder call Gemini from the Edge Functions `ai-study` and `ai-course-builder`. Course Builder also calls YouTube Data API v3 once per successful preview when `YOUTUBE_API_KEY` is set. The browser uses `supabase.functions.invoke` with the signed-in session. The functions do not use the service-role client. Course Builder inserts still go through the signed-in browser client and the existing instructor insert policies. Secrets, JWT checks, and the column lists those functions may read are in `guides/supabase.md`.

The RAG corpus is implemented in `rag_chunks` and `scripts/seed-rag-chunks.ts`. The migration is applied. The stored corpus is 572 embedded chunks: 6 course, 13 lesson, and 553 FAQ. It does not meet the 5,000 FAQ requirement. See `features/student/student-rag-corpus.md` and `assessment-2-gap.md`. Retrieval must run as the signed-in user so RLS applies. Seeding and reindexing are the only uses of the service-role client for that table, and they stay off the browser.

`ai-agent` is the student Edge Function on the same Gemini path as `ai-study`: publishable key, caller JWT, no service-role client, and no new table. The chat tools are in `features/student/student-learning-assistant.md`. The level-accuracy script is implemented in `scripts/level-accuracy.ts` and writes its report only when every held-out row is classified and accuracy on those rows is at least 0.70. Infrastructure failures are excluded from that accuracy. The level classifier is partially completed. The 19 October run classified 16 of 40 held-out rows at accuracy 1.000, then stopped on a Gemini plan quota error. `docs/assessment-2/level-accuracy.md` records that partial result. The 0.70 target is not met. The RAG evaluation is partially completed. `scripts/rag-evaluation.ts` wrote `docs/assessment-2/rag-evaluation.md` for the earlier 300-chunk corpus and was not re-run after the stored count reached 572. The 5,000 FAQ requirement is not met. Those scripts read `GEMINI_API_KEY` from the environment and are not browser routes.

## Required schema

Profiles are in `supabase/migrations/20261009133000_create_profiles.sql`. The other tables are in `supabase/migrations/20261009220000_create_lms_tables.sql`. Both of those migrations are applied on the remote project. `supabase/migrations/20261010180000_profiles_select_instructor_submission.sql` adds `profiles_select_instructor_submission` and has not been applied. `supabase/migrations/20261010230000_promote_student_to_instructor.sql` adds `promote_student_to_instructor` and narrows `prevent_profile_role_change`. It has not been applied. `types.ts` includes that function so the signed-in client can call it. `supabase/migrations/20261010233000_create_categories.sql` adds `categories` and `courses.category_id`. It has not been applied. `types.ts` includes that table and column so the client can use them; regenerate `types.ts` from the database after these migrations are applied. Naming: plural lowercase `snake_case` tables, `snake_case` columns, `id` and `created_at` on every table, foreign keys ending in `_id`. `types.ts` is generated from that schema.

| Table         | Columns                                                                                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`    | `id` (UUID of the authenticated user), `full_name`, `email`, `role` (`student`, `instructor`, `admin`), `phone`, `created_at`                                                                                                                             |
| `categories`  | `id`, `name`, `created_at`. Specified in `features/admin/admin-manage-categories.md`. The migration is local and has not been applied.                                                                                                                    |
| `courses`     | `id`, `instructor_id` → `profiles`, `title`, `description`, `level` (`beginner`, `intermediate`, `advanced`), `status` (`draft`, `pending`, `published`, `archived`), `category_id` → `categories` (optional; local migration, not applied), `created_at` |
| `lessons`     | `id`, `course_id` → `courses`, `title`, `content`, `video_url`, `order_index`, `created_at`                                                                                                                                                               |
| `enrollments` | `id`, `student_id` → `profiles`, `course_id` → `courses`, `progress` (integer, 0–100), `status` (`active`, `completed`), `created_at`                                                                                                                     |
| `assignments` | `id`, `course_id` → `courses`, `title`, `description`, `due_date`, `created_at`                                                                                                                                                                           |
| `submissions` | `id`, `assignment_id` → `assignments`, `student_id` → `profiles`, `content_url`, `grade`, `feedback`, `status` (`submitted`, `graded`), `created_at`                                                                                                      |

`categories` is added by a local migration that has not been applied. RLS requirements for private rows and `profiles.role` are in `guides/supabase.md`.

### Assessment 2 tables

These tables are specified and not migrated. Do not change the policies already defined for `profiles`, `courses`, `lessons`, `enrollments`, `assignments`, or `submissions`. Students still have no update grant on `enrollments.progress`. `enrollments_insert_student` still requires `progress` 0. `enrollments_update_instructor` stays, and no screen uses it. `enrollments_sync_status` stays: `progress` 100 sets `status` to `completed`, and any other progress sets `active`.

| Table                | Columns                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lesson_completions` | `id`, `student_id` → `profiles`, `lesson_id` → `lessons`, `created_at`. Unique on (`student_id`, `lesson_id`).                                                                                                                                                     |
| `certificates`       | `id`, `enrollment_id` → `enrollments` (unique), `student_id` → `profiles`, `course_id` → `courses`, `issued_at`, `created_at`.                                                                                                                                     |
| `notifications`      | `id`, `recipient_id` → `profiles`, `kind` (`course_completed`, `student_completed_course`, `assignment_due`), `course_id` → `courses` (optional), `enrollment_id` → `enrollments` (optional), `assignment_id` → `assignments` (optional), `title`, `body`, `read_at`, `dedupe_key` (unique), `created_at`. |
| `rag_chunks`         | `id`, `source_type` (`course`, `lesson`, `faq`), `source_key` (unique), `course_id` → `courses` (optional), `lesson_id` → `lessons` (optional), `title`, `body`, `embedding` (`vector(768)`, optional until embedded), `created_at`.                              |

Progress for one enrollment is `floor(completed lessons × 100 / lessons in that course)` when the course has at least one lesson, and `0` when it has none. A course reaches 100 only when every current lesson has a completion row for that student. The write is `sync_enrollment_progress`, a security-definer function with an empty `search_path`. `authenticated` cannot execute it. A trigger on `lesson_completions` insert calls it for that student and course. A trigger on `lessons` insert calls it for every enrollment in that course. It updates `enrollments.progress` only, and it skips the update when the stored value is already correct.

The first time that update sets `status` to `completed`, a security-definer trigger inserts one `certificates` row and two `notifications` rows: `course_completed` for the student, and `student_completed_course` for `courses.instructor_id`. The instructor body names the course and does not include the student’s email, phone, or name. A later lesson insert can lower progress and return `status` to `active`. The certificate row stays. It is not deleted, and it is not inserted again when the student reaches 100 a second time. The certificate is shown only while `status` is `completed`.

`assignment_due` rows are inserted by a scheduled job, not by that trigger. The job uses the service-role client. The browser does not. A due date after now and within 72 hours falls in one stage: 72h when more than 24 hours remain, 24h when more than 1 hour remains, and 1h otherwise. The job skips a null `due_date` and skips a student who already has a submission for that assignment. `dedupe_key` is `assignment_due:{assignment_id}:{student_id}:{stage}:{due_date}`.

`rag_chunks` uses the `vector` extension. The embedding model is `gemini-embedding-001` with `outputDimensionality` 768. The API default of 3072 is not stored. Vectors are L2-normalized before insert and before query. Distance is cosine. An HNSW index uses `vector_cosine_ops` on `vector(768)`. `match_knowledge(query_embedding vector(768), …)` is security invoker, so the caller’s RLS still applies, and it returns at most 10 rows. Authenticated users cannot insert, update, or delete chunks. The seed and the reindex use the service-role client outside the browser. The request shape is in `features/student/student-rag-corpus.md`.

Migration files:

1. `supabase/migrations/20261016220000_lesson_completions.sql` is on the linked database. Mark complete, progress 100, and status `completed` were confirmed in Chrome.
2. `supabase/migrations/20261016221000_certificates_and_notifications.sql` is on the linked database. The certificate trigger is `after update` when status becomes `completed`. Chrome confirmed the certificate sentence, both completion notices, and Mark read. The reminder endpoint is implemented. Hourly scheduling and deployment configuration are pending manual setup, and the route has not been run against the database.
3. `supabase/migrations/20261016222000_rag_chunks.sql` is applied. RAG is partially completed: 572 embedded chunks are stored, including 6 course chunks, 13 lesson chunks, and 553 FAQ chunks. The 5,000 FAQ requirement is not met. See `assessment-2-gap.md`.

### Implementation tasks

Do not start these until the feature specs are approved. Do not apply the migrations until that is asked for.

1. The lesson-completion migration is on the linked database: table, unique index, select and insert policies, `sync_enrollment_progress`, and the two triggers. Existing enrollment policies were left in place.
2. The certificates and notifications migration is on the linked database: both tables, select policies, `read_at` update for the recipient only, the update guard, and the completion trigger. The trigger is `after update` when status becomes `completed`. No delete grants.
3. Add the RAG migration: `vector` extension, `rag_chunks`, the HNSW index, select policies, and `match_knowledge`. No authenticated write grant.
4. After a migration is applied, regenerate `src/integrations/supabase/types.ts` from the database. Do not hand-edit it.
5. Mark complete is on the enrolled learning view. A completed lesson shows Completed. Chrome confirmed this on the linked database.
6. My Courses still shows the stored enrollment status. The certificate sentence is shown only when `status` is `completed` and a certificate row is returned. Chrome confirmed both.
7. The signed-in user’s notifications are listed from the shared header bell, not from My Courses or Instructor Dashboard. Marking one read sets only `read_at`. Chrome confirmed the student Mark read and the instructor completion notice before the bell moved that list.
8. The assignment reminder endpoint is implemented as `POST /api/assignment-reminders`. It checks the cron bearer, then inserts `assignment_due` rows through the service-role client and the dedupe key above. It does not run from the browser. Hourly scheduling and deployment configuration are pending manual setup. The hourly caller is documented in the README. It has not been run against the database.
9. The idempotent seed is `scripts/seed-rag-chunks.ts`. It upserts course chunks, then lesson chunks, then FAQ chunks, and stores a normalized 768-dimensional embedding when `GEMINI_API_KEY` and the service-role key are set. It reindexes a chunk when that text changes and does not insert a second `source_key`. `RAG_EMBED_RECORD_LIMIT` defaults to 300. The 19 October resumes raised that limit and stopped on the Gemini plan quota. The latest stored count is 572 embedded chunks: 6 course, 13 lesson, and 553 FAQ. The 5,000 FAQ requirement is not met.
10. Add Vitest coverage for the progress fraction, the one-certificate rule, notification dedupe, and a retrieval check that draft lesson text is not returned to a student who is not enrolled.
11. `ai-agent` and `/student/assistant` are implemented, and `ai-agent` is deployed on the linked project. A signed-in Chrome pass showed the empty prompt, “Enter a question.”, Sending, one assistant reply, and an offline error that restored the draft. The function uses the student JWT, the existing Gemini JSON path, and the five tools in `features/student/student-learning-assistant.md`. Enrol runs only when the student asks to join a course. No table was added. A signed-in student pass at 390px and 320px found no horizontal overflow on the student pages, the open notification panel, or the mobile sidebar. No student page showed a table. Instructor and admin layouts were not opened at those widths.
12. The level classifier is partially completed. The labelled file is `scripts/fixtures/level-labelled.json` and the script is `scripts/level-accuracy.ts`. It writes `docs/assessment-2/level-accuracy.md` only when the seed-42 held-out accuracy is at least 0.70 and every test row was classified. The 19 October run resumed 16 saved predictions and stopped on a Gemini plan quota error. Coverage is 0.400, accuracy on the classified rows is 1.000, and 23 rows were not called. `docs/assessment-2/level-accuracy.md` records that partial result and does not meet the 0.70 bar. The script does not update `courses.level` or insert the labelled rows into `courses`.
13. RAG evaluation is partially completed. `scripts/rag-evaluation.ts` wrote `docs/assessment-2/rag-evaluation.md` for the earlier 300-chunk corpus and was not re-run after the stored count reached 572. The report states Hit@5, MRR@5, and mean top-1 cosine for the keyed sets. Extreme rejection at cosine 0.75 is 1.000 and is stated under the table, with the out-of-corpus mean top-1 cosine of 0.537. The matching-versus-noisy delta is 0.000. The 5,000 FAQ requirement is not met.
14. Add Vitest coverage for the tool guards, the train/test split, and the retrieval metrics, with Gemini mocked. The live accuracy and retrieval numbers come from the two scripts.
15. The README links `docs/assessment-2/level-accuracy.md` and `docs/assessment-2/rag-evaluation.md`. The accuracy file is the partial 19 October result.

The Assessment 2 end-to-end happy path is `src/test/student-happy-path.test.tsx`. `npm run test:e2e` passed 1 test. It runs in Vitest/jsdom against an in-memory store and clears that store afterwards. It does not verify live Supabase or a real browser, and it does not add a migration. See `assessment-2-gap.md`.

## Open questions

- Product behavior that the assignment leaves open is listed in `product.md`. Do not fill those gaps here.
