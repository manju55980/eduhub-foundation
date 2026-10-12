# EduHub foundation plan

## Current findings and assumptions

- The project already uses React, TypeScript, TanStack Start, and file-based routes; keep that foundation rather than introducing another framework.
- Lovable Cloud is now connected, but the public database has no application tables. No tables, policies, or business data have been created. The plan targets this Cloud backend; connect a different existing backend through the editor first if that is the intended target.
- The assignment requires student, instructor, and admin areas, email/password and Google sign-in, and the course-to-grade workflow. Those workflows and backend rules are explicitly deferred here.
- The reference informs the visual direction only: a calm education dashboard, clear role-specific navigation, generous spacing, restrained pastel accents, and compact summary cards. Do not embed or recreate the reference image.

## Proposed project structure

```text
src/
  components/
    app-shell/
      app-shell.tsx       # shared page frame
      app-sidebar.tsx     # role-specific menu from navigation config
      app-header.tsx      # page title and account area
  features/
    student/              # student page bodies, added as content is built
    instructor/           # instructor page bodies
    admin/                # admin page bodies
  lib/
    roles.ts              # Role type and role-to-navigation map only
  routes/
    __root.tsx            # shared providers and document shell
    index.tsx             # public entry
    auth.tsx              # auth-screen location; no working sign-in in phase 1
    student/              # student layout, dashboard, and assignment pages
    instructor/           # instructor layout and course/submission pages
    admin/                # admin layout and catalogue/user/report pages
  styles.css              # semantic design tokens and global styles
```

Keep route files thin, render nested route content through `<Outlet />`, and avoid a generic dashboard framework or extra state-management layer. Use existing UI primitives where they fit.

## Assignment routes to reserve

- **Public:** `/` entry and `/auth`.
- **Student:** `/student/courses` (browse), `/student/my-courses`, `/student/my-courses/$courseId` (learning), `/student/assignments`, `/student/grades`, `/student/profile`.
- **Instructor:** `/instructor` (dashboard), `/instructor/courses/new`, `/instructor/courses`, `/instructor/courses/$courseId/lessons`, `/instructor/submissions`, `/instructor/profile`.
- **Admin:** `/admin` (dashboard), `/admin/courses/approvals`, `/admin/users`, `/admin/categories`, `/admin/enrollments`, `/admin/reports`.

## Role and access structure

- Define the three allowed role names once and map each role to only its assignment-listed navigation items.
- Treat the sidebar and route layout as presentation, not security. When authentication is implemented, enforce access through verified sessions and database policies.
- Keep authorization roles in a protected, server-controlled role source (a separate roles table), not in user-editable profile fields. The assignment's `profiles.role` sketch must not become the security authority.
- Keep profile information (name, email, phone) conceptually separate from permissions. No profile or role records are created in this foundation phase.

## Phases and ownership

1. **Foundation — Lovable now:** establish the shared shell, semantic color/type/spacing tokens, role-based navigation configuration, and lightweight route/layout shells for the assignment pages. Keep page bodies to clear titles and empty states; add no fabricated metrics, calendar events, courses, or users.
2. **Authentication and data — Lovable Cloud later:** implement required sign-in methods, profile details, server-owned role assignment, schema, and least-privilege access rules after the foundation is approved. Confirm the actual Cloud target before schema work.
3. **Workflow — Cursor after GitHub sync:** build and test course authoring/approval, enrolment, lessons, submissions, grading, and role-specific data states. Keep changes in one working copy at a time and review them in Lovable preview.
4. **Demo readiness — Lovable + Cursor:** test all three roles end to end, then handle GitHub/Vercel release setup and live sign-in checks. The current GitHub/Vercel connection state has not been verified.

## Not in phase 1

No database tables or migrations, RLS/policies, auth implementation or provider configuration, role assignment logic, CRUD/business workflows, mock business data, reports/charts, upload storage, AI assistant, progress animation, or deployment. These are deliberately staged for later phases rather than represented with fake data or non-working controls.
