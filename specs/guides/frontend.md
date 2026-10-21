# Frontend

Read this before changing routes, screens, or shared UI. The current tree and stack are in `architecture.md`. Pages to build are in `product.md`.

## Routing

Keep the Lovable TanStack Start app. Do not replace the framework, router, or styling stack.

Routes are files in `src/routes`. Follow `src/routes/README.md`. Do not add `src/pages/` or a Next.js-style `app/` directory. Do not hand-edit `src/routeTree.gen.ts`.

`src/routes/__root.tsx` must keep `<Outlet />`. It already provides the document shell, TanStack Query, the 404 page, and the error boundary. Nested layouts render children with `<Outlet />`.

Route files stay thin. See `coding-standards.md`. Do not introduce a generic dashboard framework.

Recorded paths for each sidebar item are in `product.md`. Each role layout uses `components/app-shell/` and the navigation map in `lib/roles.ts`. Unfinished pages do not show records or actions.

## Feature organization

Shared chrome is in `components/app-shell/`. Role screens belong in `features/<role>/` when they have behavior.

```text
src/
  components/app-shell/     # shared frame, sidebar, header
  features/student/
  features/instructor/
  features/admin/
  lib/roles.ts              # role names and navigation map only
  routes/auth.tsx
  routes/student/
  routes/instructor/
  routes/admin/
```

Put screen UI in `src/features/<role>/`. Put that area’s Supabase calls in a small feature module, not in presentational components. See `guides/supabase.md`.

Feature specs use the same role split: `specs/features/instructor/`, `specs/features/student/`, and `specs/features/admin/`.

`lib/roles.ts` maps each role to only that role’s navigation items.

## Shared components

Put shared chrome in `src/components/`, including `app-shell/`. Use the existing shadcn/ui components in `src/components/ui` before adding a primitive. Combine classes with `cn()` from `src/lib/utils.ts`.

`components.json` aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`.

## UI conventions

Tokens live in `src/styles.css` (`oklch`, light and dark). The palette is professional blue and neutral: white surfaces, a cool gray page, a blue primary, and subtle borders. Role tints `--student-soft`, `--instructor-soft`, `--admin-soft`, and `--brand-soft` stay inside that palette. Status text uses `--lozenge-foreground`. The active sidebar item uses `--sidebar-accent`. Corner radii stay small (`--radius` is 3px). Body type is the system stack starting at SF Pro Display.

Dark token values live on `.dark`. The signed-in header control, beside the notification bell, stores `light` or `dark` in `localStorage` under `eduhub-theme` and sets that class on `html`. The default is light. The same preference applies on every page after refresh and navigation.

Shared chrome is `components/app-shell/`. Page titles use `PageHeader`. A signed-in page uses `PageSection` (`pageFrameClass`: full content width, `space-y-5`). A form, chat, or profile may add `max-w-xl` or `max-w-3xl`. Records with a description or an editor use `RecordCard`. Course and record grids use `recordGridClass`. Search and status choices use `FilterToolbar` and `ChoiceButton`. A count tile uses `SummaryCounts` only when choosing it filters the loaded records. Dense rows use `DataTable` inside a `BoardSection` when the page is a dashboard. Combine classes with `cn()`. Reuse `panelClass` for a sharp bordered surface. Do not introduce a second visual system, pastel card tints, or charts.

## Visual direction

Jira-inspired, adapted to EduHub’s existing screens. Future UI work follows this direction. The shell in `product.md` stays: wordmark, graduation-cap mark, Menu group, footer line, and the header name, email, role, and Log out.

- **Surface.** White panels on a neutral page. A 1px border. Almost square corners. No drop shadows on cards, buttons, or fields.
- **Spacing.** Compact. Page sections use a short stack. Do not add large hero padding or oversized empty areas inside a record.
- **Type.** A clear page title, then smaller section labels. Record titles are medium weight, not display type.
- **Status.** `StatusBadge` is a compact lozenge. Draft and archived are neutral. Pending and Admin use a blue outline. Published, completed, graded, and Instructor use a stronger blue fill. Active, submitted, and Student use a lighter blue fill.
- **Layout.** Use a card for a summary, a course, an enrollment, a submission, or a form. Use a table for dense rows such as users, reports, and dashboard rows. Below the `md` breakpoint, `DataTable` stacks each row and shows the column name with the value, so the page does not keep a 40rem-wide table. Record grids are one column until `lg`, then two. Do not put a card inside another card. Do not repeat the sidebar as dashboard tiles. A summary count is a filter for records already loaded, not a chart.
- **States.** Loading, empty, and error stay the shared treatments in `page-state.tsx`. Empty copy stays the sentence already specified for that screen.

The older showcase image at [EduHub UI Reference](<./references/EduHub Dashboard UI Showcase.png>) is not the current visual system. Its counts, charts, sample records, search, notifications, and all-roles sidebar are not requirements.
