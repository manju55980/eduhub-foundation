# Constitution

Rules for all EduHub work. Assignment requirements live in `EduHub_Assignment1_Requirements.md`. Product scope lives in `product.md`. Repository shape lives in `architecture.md`. Implementation conventions live in `coding-standards.md`.

## Purpose

EduHub is a small LMS for the SJ Innovation Week 1 assignment. Build the core assignment path first. Bonus features wait until that path works.

## Development

- Develop in Cursor. The repository stays connected to Lovable. The history warning is in `AGENTS.md`.
- `EduHub_Assignment1_Requirements.md` is the assignment source of truth. These specs record how the project applies it.
- Do not invent screens, roles, tables, or workflows. If a requirement is incomplete, leave it unresolved in the specs.
- When a decision is made, record it in the specs before spreading it through the code.

## Code

Follow `coding-standards.md`.

## Data and access

- Supabase is the backend. Both local migrations are listed in `guides/supabase.md`. Both are applied on the remote project.
- Store `role` on `profiles` as `student`, `instructor`, or `admin`.
- New users are Student by default.
- Only an Admin can promote a user to Instructor.
- The first Admin is set manually in Supabase, not through signup.
- Users must not be able to change their own role. Enforce that with RLS. No extra role-management table is specified.
- Navigation is not security. Hide links for clarity, and enforce roles on the server and with database policies. Practical steps are in `guides/supabase.md`.

## What not to do yet

- Do not add tables or columns beyond the required schema.
- Category storage is specified in `features/admin/admin-manage-categories.md`. Do not invent report metrics. Course status, grades, progress, and submission storage follow `product.md`.
- Do not start the bonus progress animation or deployment until the core path works. Deployment to Vercel is a required deliverable after that path, not a bonus.
- The AI Study Companion and AI Course Builder are specified. They add no table, column, or policy. Gemini is called only from Supabase Edge Functions.
