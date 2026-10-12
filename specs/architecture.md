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

Study Companion and Course Builder call Gemini from the Edge Functions `ai-study` and `ai-course-builder`. The browser uses `supabase.functions.invoke` with the signed-in session. The functions do not use the service-role client. Course Builder inserts still go through the signed-in browser client and the existing instructor insert policies. Secrets, JWT checks, and the column lists those functions may read are in `guides/supabase.md`.

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

`categories` is the one added table. Its migration is local and has not been applied. RLS requirements for private rows and `profiles.role` are in `guides/supabase.md`.

## Open questions

- Product behavior that the assignment leaves open is listed in `product.md`. Do not fill those gaps here.
