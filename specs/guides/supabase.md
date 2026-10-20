# Supabase

Read this before changing Supabase clients, auth, schema, or policies. The required tables are in `architecture.md`. Who can do what is in `product.md` and `constitution.md`.

## Configuration

`supabase/config.toml` only sets `project_id` to `thuaplbbrzkblozboymg`. Migrations, in order:

- `supabase/migrations/20261009133000_create_profiles.sql`
- `supabase/migrations/20261009220000_create_lms_tables.sql`
- `supabase/migrations/20261010180000_profiles_select_instructor_submission.sql`
- `supabase/migrations/20261010230000_promote_student_to_instructor.sql`
- `supabase/migrations/20261010233000_create_categories.sql`

Specified for Assessment 2:

- `supabase/migrations/20261016220000_lesson_completions.sql` matches the linked database. Its tables, policies, grants, and triggers were already present.
- `supabase/migrations/20261016221000_certificates_and_notifications.sql` matches the linked database. The certificate trigger is `after update` with the completed-status condition, because `update of status` does not see the status assigned by `enrollments_sync_status`.
- `supabase/migrations/20261016222000_rag_chunks.sql` is applied. RAG is partially completed at 572 embedded chunks: 6 course, 13 lesson, and 553 FAQ. The retrieval report still scores the earlier 300-chunk run. The 5,000 FAQ requirement is not met. See `assessment-2-gap.md`.

The first two files are applied on the remote project. The instructor submitter-name policy, the student-to-instructor promotion, and categories are local and have not been applied. Lesson completions, certificates, and notifications are on the linked database. The RAG corpus migration is applied. Do not apply further database changes without saying so first.

When a migration is added, create only the tables and columns in `architecture.md`. `categories` and `courses.category_id` are specified in `features/admin/admin-manage-categories.md`. Lesson completion, certificates, notifications, and `rag_chunks` are specified in `architecture.md`. Do not add a second roles table or any other unspecified table.

`drizzle-orm` and `postgres` are installed. `drizzle/schema.ts` is an empty generated file. Leave it blank. It is not the data layer.

## Environment

Local env is `.env`. It is not gitignored by name. Do not commit secrets beyond the existing publishable key, and do not print secret values.

Expected names:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` — required by `client.server.ts`, not set in `.env` today

`SUPABASE_PROJECT_ID` and `VITE_SUPABASE_PROJECT_ID` use `thuaplbbrzkblozboymg`.

## Generated types and clients

Do not hand-edit generated Supabase files. `types.ts` is generated from the applied schema. Regenerate it after a new migration is applied. Do not fill in tables by hand.

- `client.ts` — browser and SSR client using the publishable key. Import as `supabase` from `@/integrations/supabase/client`.
- `client.server.ts` — service-role client. Dynamic-import it only inside server handlers. It bypasses RLS.
- `auth-attacher.ts` — registered in `src/start.ts`. It attaches the session bearer token to server functions.
- `auth-middleware.ts` — `requireSupabaseAuth` validates a bearer JWT and provides `supabase`, `userId`, and `claims`. Not used by any route yet.
- `previewAuthStorage.ts` and `cron-auth.ts` — Lovable preview and cron helpers. Leave them in place.

Server functions already pass through the middleware listed in `architecture.md`.

## Authentication

Sign-in is email/password and Google, through the existing Supabase client. Do not build a parallel auth store. Login is required for dashboards.

User-scoped server work uses `requireSupabaseAuth`, so queries run as the signed-in user and RLS applies. Do not use `supabaseAdmin` for ordinary role checks.

The first Admin is configured manually in Supabase, outside the app. In-app promotion does not use the service role. A signed-in admin calls `promote_student_to_instructor` for a different student. See `features/admin/admin-manage-users.md`. New profiles are created by the `handle_new_user` trigger in `supabase/migrations/20261009133000_create_profiles.sql`, always with `role` `student`.

## Edge Functions

`supabase/functions/ai-study`, `supabase/functions/ai-course-builder`, and `supabase/functions/ai-agent` are the AI entry points. `verify_jwt` is true for each of them in `supabase/config.toml`. Each function builds a Supabase client with `SUPABASE_URL` and `SUPABASE_ANON_KEY`, or `SUPABASE_PUBLISHABLE_KEY` when the anon key is not injected, plus the caller’s bearer token. It does not read `SUPABASE_SERVICE_ROLE_KEY`. Queries run as that user, so the existing RLS policies apply. The RAG seed script is the service-role path, and it is not a browser request.

`GEMINI_API_KEY` is a Supabase function secret used only inside those functions. Do not put it in `.env` as a `VITE_` name, and do not send it to the browser. A missing key returns “AI is not configured.” The response does not include the secret or the upstream error body.

`ai-study` reads `profiles.role`, then `courses.title` and `courses.description`, then `enrollments.id`, then `lessons.title` and `lessons.content`. It does not read grades, submissions, or other courses. `ai-course-builder` reads only `profiles.role`. It does not insert rows.

`POST /api/assignment-reminders` is the scheduled assignment reminder. It is not an Edge Function and not a browser route. The cron bearer is checked before the service-role client inserts `assignment_due` notifications. Course completion stays on the `enrollments_issue_certificate` trigger. The endpoint is implemented. The published app has no built-in caller that can POST this path with `LOVABLE_CRON_SECRET`. Hourly scheduling and deployment configuration are pending manual setup. The hourly caller is documented in the README. It has not been invoked against the database.

These functions do not add a table, column, or policy. Set the secret with `supabase secrets set GEMINI_API_KEY` before calling them. The chat model is `gemini-3.5-flash-lite`, which has free-tier input and output on the Gemini Developer API. The level-accuracy and RAG-evaluation scripts are not Edge Functions. They read that same secret from the environment when run locally, and they are not shipped to the browser.

## RLS and role permissions

Apply the data and access rules in `constitution.md` with RLS and server handlers. A hidden sidebar link is not enough.

RLS must stop users from reading other users’ private rows, including other students’ grades, and must stop a user from changing their own `profiles.role`.

Policies must not subquery `courses` and `enrollments` into each other. That recurses. `is_course_owner`, `is_enrolled`, and `is_published_course` in the LMS migration do those checks as `SECURITY DEFINER` functions with an empty `search_path`. Only `authenticated` can execute them. The signed-in user is still the subject of the check.
