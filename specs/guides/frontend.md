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

Tokens live in `src/styles.css` (`oklch`, light and dark). The palette is forest green on warm neutrals, with blue reserved for focus, selection, and in-progress status. Role tints `--student-soft`, `--instructor-soft`, `--admin-soft`, and `--brand-soft` stay inside that palette. The active sidebar item uses `--sidebar-accent` (blue), not the green primary. Body type stays the system stack starting at SF Pro Display. Do not add a second typeface.

Dark token values live on `.dark`. The signed-in header control, beside the notification bell, stores `light` or `dark` in `localStorage` under `eduhub-theme` and sets that class on `html`. The default is light. The same preference applies on every page after refresh and navigation, including student, instructor, and admin.

Shared chrome is `components/app-shell/`. Page titles use `PageHeader`. A signed-in page uses `PageSection` (`pageFrameClass`: full content width, `space-y-5`). A form, chat, or profile may add `max-w-xl` or `max-w-3xl`. Records with a description or an editor use `RecordCard`. Course and record grids use `recordGridClass`. Search and status choices use `FilterToolbar` and `ChoiceButton`. The submissions To Grade / Graded switch uses `ChoiceButton`, not a second tab style. A count tile uses `SummaryCounts` only when choosing it filters the loaded records. Count tiles use the shared surface. They do not use role tints. Dashboard regions use `BoardSection` and record cards. Dense management lists, Manage Users and Reports, use `DataTable`. Do not put `DataTable` inside a dashboard `BoardSection`. Combine classes with `cn()`. Reuse `panelClass` for the shared raised surface. Do not introduce a second visual system, tinted record cards, or charts.

When this direction is implemented, map it in `src/styles.css` only. Do not add a parallel token file.

### Color

Light values live on `:root`. Dark values live on `.dark`. Text and control labels meet 4.5:1 against their background. Non-text boundaries, including the focus ring against the adjacent surface, meet 3:1. Status is never color alone: `StatusBadge` keeps its text label.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `oklch(0.975 0.012 95)` | `oklch(0.22 0.02 95)` | Warm page |
| `--foreground` | `oklch(0.28 0.03 150)` | `oklch(0.96 0.01 95)` | Body text |
| `--card`, `--popover` | `oklch(0.995 0.006 95)` | `oklch(0.27 0.02 95)` | Raised surface |
| `--primary` | `oklch(0.42 0.09 155)` | `oklch(0.74 0.11 155)` | Forest brand |
| `--primary-foreground` | `oklch(0.99 0.005 95)` | `oklch(0.22 0.04 155)` | Label on primary |
| `--primary-hover` | `oklch(0.48 0.09 155)` | `oklch(0.80 0.09 155)` | Primary control hover |
| `--sage` | `oklch(0.94 0.03 150)` | `oklch(0.34 0.04 155)` | Hover wash for outline, ghost, and rows |
| `--secondary`, `--muted` | `oklch(0.95 0.012 95)` | `oklch(0.30 0.02 95)` | Quiet fill |
| `--muted-foreground` | `oklch(0.45 0.03 150)` | `oklch(0.78 0.02 95)` | Meta text |
| `--border`, `--input` | `oklch(0.88 0.015 95)` | `oklch(0.96 0.01 95 / 0.14)` | 1px edge |
| `--ring`, `--active` | `oklch(0.50 0.14 255)` | `oklch(0.74 0.12 255)` | Blue focus and selected emphasis |
| `--destructive` | `oklch(0.55 0.2 25)` | `oklch(0.70 0.17 25)` | Errors |
| `--student-soft` | `oklch(0.94 0.035 150)` | `oklch(0.32 0.04 150)` | Light sage banner |
| `--instructor-soft` | `oklch(0.88 0.05 155)` | `oklch(0.36 0.06 155)` | Deeper green banner |
| `--admin-soft` | `oklch(0.94 0.03 85)` | `oklch(0.34 0.03 85)` | Warm sand banner |
| `--brand-soft` | `oklch(0.95 0.025 150)` | `oklch(0.32 0.03 150)` | Quiet brand wash |
| `--sidebar` | same as `--card` | same as `--card` | Sidebar surface |
| `--sidebar-accent` | `oklch(0.94 0.03 255)` | `oklch(0.32 0.05 255)` | Selected nav |
| `--sidebar-accent-foreground` | `oklch(0.36 0.11 255)` | `oklch(0.92 0.03 255)` | Selected nav label |
| `--positive` | `oklch(0.40 0.09 155)` | `oklch(0.78 0.10 155)` | Stronger green status fill’s foreground partner |
| `--positive-soft` | `oklch(0.90 0.06 155)` | `oklch(0.34 0.06 155)` | Published, completed, graded, Instructor |
| `--positive-foreground` | `oklch(0.32 0.08 155)` | `oklch(0.92 0.04 155)` | Text on `--positive-soft` |
| `--progress-soft` | `oklch(0.94 0.03 255)` | `oklch(0.32 0.05 255)` | Active, submitted, Student |
| `--progress-foreground` | `oklch(0.36 0.11 255)` | `oklch(0.90 0.04 255)` | Text on `--progress-soft` |

`--primary-hover` stays dark enough in light mode, and light enough in dark mode, for `--primary-foreground` at 4.5:1. The pale sage wash is not the primary-button hover. Sage is the hover background for outline, ghost, sidebar items that are not selected, summary counts, and table rows, with `--foreground` or `--sidebar-foreground` as the label.

`--sidebar-foreground` matches `--foreground`. `--sidebar-border` matches `--border`. `--sidebar-ring` matches `--ring`. `--accent` matches `--sage`. It is not a second hover color. Layout measurements and route acceptance are in `../design/application-ui-modernization.md`.

Banner tints keep dark text in light mode and light text in dark mode, at 4.5:1. `--instructor-soft` is a wash, not the solid primary.

### Radius

One scale. Do not collapse `--radius-md` and `--radius-xl` back to 3px.

| Surface | Radius |
| --- | --- |
| Buttons, inputs, textareas, native selects, nav items | 8px |
| Cards, dialogs, popovers, menus, sheets, tables | 12px |
| `StatusBadge` only | pill |

The sidebar panel stays flush to the viewport. Its items use 8px.

### Elevation, border, motion

Raised surfaces (cards, dialogs, popovers, menus, tables) use a 1px `--border` and `--shadow-raised`: `0 1px 2px oklch(0.28 0.03 150 / 0.06), 0 1px 3px oklch(0.28 0.03 150 / 0.05)`. In dark mode the same shadow uses `oklch(0 0 0 / 0.35)`. Inputs and buttons keep the 1px border. They do not use a second, heavier shadow. Primary buttons may use the same `--shadow-raised`.

Color, background, border, and shadow transition in 150ms on controls and 200ms on raised surfaces, with `cubic-bezier(0.2, 0, 0, 1)`. Do not animate layout. `prefers-reduced-motion: reduce` sets those durations to 0ms.

### Type and spacing

| Role | Size | Weight |
| --- | --- | --- |
| Signed-in page title | 1.25rem, 1.5rem from `sm` | semibold |
| Public landing hero | 1.875rem, 2.25rem from `sm` | semibold |
| Section label | 0.75rem, uppercase, tracked | semibold |
| Record title | 1rem | medium |
| Body, controls, table cells | 0.875rem | regular |
| Meta label | 0.75rem | medium, muted |

Page sections stay a short stack (`space-y-5`). Cards use `p-4`. Record grids use `gap-3`. The shell content padding stays `p-4`, and `md:p-6`. Do not add large hero padding or oversized empty areas inside a signed-in record. The public landing hero uses the hero row above. Signed-in titles do not. Landing and sign-in use these tokens. They do not use a second radius or shadow scale.

### Component states

Every shared control has default, hover, focus-visible, pressed, and disabled. Disabled is 50% opacity and does not change color on hover. Focus-visible is a 2px `--ring` with 2px offset. Do not remove the ring. The selected nav item uses `--sidebar-accent`, including on nested routes whose parent item is the current section. Pressed primary uses `--primary-hover`. Errors use `--destructive` and `ErrorState`. Loading and empty stay the shared treatments in `page-state.tsx`.

## Visual direction

A compact educational workspace: forest green brand, warm surfaces, 8px controls, 12px panels, and blue for focus and selection. Future UI work follows this direction. The shell in `product.md` stays: wordmark, graduation-cap mark, Menu group, footer line, and the header name, email, role, and Log out. The same shell fits student, instructor, and admin. Below `md`, the sidebar is the existing overlay and `DataTable` stacks each row with its column name. Record grids are one column until `lg`, then two.

- **Surface.** Warm page, softer card. A 1px border and `--shadow-raised`. Corners follow the radius table.
- **Spacing.** Compact, as in Type and spacing above.
- **Type.** A signed-in page title is 1.25rem, 1.5rem from `sm`. The public landing hero is 1.875rem, 2.25rem from `sm`. Record titles are medium weight, not display type. The system stack stays.
- **Status.** `StatusBadge` is a pill. Draft and archived are neutral. Pending and Admin use a blue outline. Active, submitted, and Student use a lighter blue fill. Published, completed, graded, and Instructor use the stronger green fill (`--positive-soft`). Completed does not use a separate hue.
- **Layout.** Use a card for a summary, a course, an enrollment, a submission, a dashboard row, or a form. Use `DataTable` for dense management data: Manage Users and Reports. Do not put a card inside another card. Do not repeat the sidebar as dashboard tiles. A summary count is a filter for records already loaded, not a chart.
- **States.** Loading, empty, and error stay the shared treatments in `page-state.tsx`. Empty copy stays the sentence already specified for that screen.
- **Certificate.** The certificate document uses warm paper (`--background` light) and forest green rules, wordmark, and seal. Body text uses `--foreground` light. Print and the downloaded PDF use those same colors. The document does not switch to the dark theme.

The older showcase image at [EduHub UI Reference](<./references/EduHub Dashboard UI Showcase.png>) is not the current visual system. Its counts, charts, sample records, search, notifications, and all-roles sidebar are not requirements.
