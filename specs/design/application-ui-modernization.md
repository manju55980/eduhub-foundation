# Application UI modernization

Visual measurements for the existing EduHub screens. Color, radius, shadow, motion, and contrast stay in `guides/frontend.md`. Behavior, empty sentences, and permissions stay in the feature specs named on each route. This file does not add a token, a route, a sidebar item, or an action.

If a measurement here is more specific than `guides/frontend.md`, use this file for layout. If a color here would need a new token, do not add it. Use the token already named in `guides/frontend.md`.

Breakpoints are the existing Tailwind steps: below `md` (768px), `md`, and `lg` (1024px). Summary counts also use `xl` (1280px). Type is the system stack in `guides/frontend.md`. Do not add a font.

## Shared measures

| Name | Value | Use |
| --- | --- | --- |
| Page stack | 20px (`space-y-5`) | Between header, banner, filters, and the record region |
| Shell padding | 16px, 24px from `md` | Content inside the header and below it |
| Card padding | 16px | Record, form, empty, and summary surfaces |
| Grid gap | 12px | Record grids and summary counts |
| Control height | 36px, 32px for `sm` | Buttons, inputs, selects, icon buttons |
| Control padding | 12px horizontal, 4px vertical | Text inputs and default buttons |
| Control radius | 8px | Buttons, inputs, textareas, native selects, nav items |
| Surface radius | 12px | Cards, dialogs, popovers, menus, tables |
| Badge radius | pill | `StatusBadge` only |
| Focus | 2px `--ring`, 2px offset | Every shared control |
| Border | 1px `--border` or `--input` | Raised surfaces and fields |
| Shadow | `--shadow-raised` | Cards, dialogs, popovers, menus, tables, primary buttons |
| Control motion | 150ms, `cubic-bezier(0.2, 0, 0, 1)` | Color, background, border, shadow |
| Surface motion | 200ms, same easing | Raised surfaces |
| Reduced motion | those durations become 0ms | Do not animate layout |

Disabled controls are 50% opacity and do not change color on hover. Pressed primary uses `--primary-hover`. Outline, ghost, unselected nav, and table rows hover with `--sage` and `--foreground` or `--sidebar-foreground`. Sage is not the primary-button hover. `--accent` is the same value as `--sage`. Hover washes use `--sage`.

## Shared components

| Component | Responsibility |
| --- | --- |
| `AppShell` | Signed-in frame only. Public routes, the profile error, the 404, and the root error do not use it. |
| `AppSidebar` | That role’s navigation from `product.md`. It does not render page records or actions. |
| `AppHeader` | Identity, theme, notifications, and Log out. It does not repeat the sidebar. |
| `PageHeader` | Title, optional description, and optional back link. |
| `PageSection` | The 20px stack at the route’s width. |
| `CourseListing` | Linked course card. The details link covers the title, description, and meta. |
| `RecordCard` | The same surface without a details link. |
| `BoardSection` | A dashboard label only. It is not a card and it does not wrap `DataTable`. |
| `DataTable` | Manage Users and Reports only. |
| `FilterToolbar` | Client-side search of rows already loaded, plus that route’s existing choices. |
| `ChoiceButton` | A pressed filter. The grading switch also keeps `role="tab"` and `data-state`. |
| `SummaryCounts` | Manage Courses only. |
| `StatusBadge` | A status or role label. |
| `SaveNotice` | The dismissible success banner. |
| `LoadingState`, `EmptyState`, `ErrorState` | Section 9. Empty copy stays the feature-spec sentence. |

## 1. Global shell and navigation

Signed-in student, instructor, and admin routes use `AppShell`. Public routes do not.

### Sidebar

| Part | Measure |
| --- | --- |
| Desktop width | 256px, flush to the viewport, no outer radius |
| Mobile sheet | `min(18rem, calc(100vw - 1rem))`, from the left, below `md` only |
| Surface | `--sidebar` (same as `--card`), right edge 1px `--sidebar-border`, no shadow on the desktop panel |
| Header | 20px horizontal, 20px vertical. Mark is a 20px graduation cap in `--primary`. Wordmark is 16px semibold `--foreground`, 8px gap |
| Group label | “Menu”, 12px medium `--muted-foreground`, existing sidebar label inset |
| Item | 8px radius, 8px padding, 14px regular, icon 16px, 8px gap, min height 32px. Label wraps. Items stack with 4px gap |
| Hover | `--sage` background, `--sidebar-foreground` text |
| Selected | `--sidebar-accent` background, `--sidebar-accent-foreground` text, medium weight. Stays selected on hover |
| Focus | 2px `--sidebar-ring`, 2px offset |
| Footer | 16px horizontal, 20px vertical. 16px sprout icon, 8px gap, 12px `--muted-foreground`: “Better learning builds brighter futures.” |

The selected item is the longest navigation path that equals the current path or is its parent. `/instructor` and `/admin` match only themselves. `/instructor/courses/new` selects Create Course, not My Courses. `/admin/courses/approvals` and `/admin/courses/archive` select Manage Courses. The instructor items for `/instructor/courses` and `/instructor/submissions` are labeled “My Courses” and “Submissions”. Those strings are also the page headings. Lesson and assignment back links use “My Courses”.

Below `md`, choosing an item closes the sheet. Desktop sidebar does not collapse to icons.

### Header

Height is content plus 12px vertical padding. Horizontal padding matches the shell. Bottom border is 1px `--border`. Background is `--background`. Below `md`, the menu trigger is a 36px outline icon button at the start. From `md` it is hidden.

Identity sits in a 12px gap: 32px outline icon button (initials at 12px, or a 16px user icon), then a block that can shrink. Name is 14px semibold, one line, truncated. Detail is 12px `--muted-foreground`, truncated: email, middle dot, role label. The role label is Student, Instructor, or Admin.

The right cluster does not shrink: theme toggle, notification bell, Log out. Gap is 8px, 12px from `sm`. Theme and bell are 36px outline icon buttons. Log out is the existing outline button, 36px tall, 8px radius.

### Content frame

`PageSection` is full width of the inset, `min-width: 0`, 20px vertical stack. A profile uses `max-w-xl` (36rem). The learning assistant uses `max-w-3xl` (48rem). The certificate page uses `max-w-5xl` (64rem). Those columns stay left aligned.

`PageHeader` stacks 8px. The back link, when the route has one, is 14px `--muted-foreground`, 16px arrow, 6px gap, hover `--foreground`. Title is 20px semibold, 24px from `sm`, tight leading. Description is 14px `--muted-foreground`, max 42rem. Do not add a hero.

### Public frames

`/` and `/auth` have no sidebar. Page background is `--background`. Content on `/` is max 72rem, 24px horizontal padding. `/auth`, the profile-error frame, the 404, and the root error frame center one 28rem surface: 16px padding, 12px radius, 1px border, `--shadow-raised`, 16px stack.

The public landing hero title is 30px, 36px from `sm`, semibold, max 48rem, centered. Signed-in page titles stay 20px, 24px from `sm`. Landing section titles are 24px semibold and centered. Body is 16px, 18px from `sm`, max 36rem. Record titles inside landing cards stay 16px medium. The header is 24px vertical padding, with the mark and wordmark on the left and the text actions on the right. The hero is centered, 40px vertical padding, 56px from `sm`. Later sections have 48px padding above and 16px below, and the last section has 32px below. Grids use 12px gap, 24px above the grid. The step list uses 16px gap and 32px above it. Cards use the 12px surface. Header and hero buttons use the 8px control. Role icon chips are 32px with the role soft tint. The footer is a top border, 24px vertical padding, 12px `--muted-foreground`, centered. Do not add a second radius or a pastel card fill. Do not use the hero size on a signed-in page.

## 2. Course cards and record cards

`CourseListing` is the linked course card. `RecordCard` is the same card without a details link. Both use `panelClass`.

### Anatomy

```text
┌─ 12px radius, 1px border, --shadow-raised, 16px padding ─┐
│ Title 16px medium                          StatusBadge   │
│ Description 14px muted, only when stored                 │
│ MetaList                                                 │
│ Footer links or actions, 8px gap, pinned to the bottom   │
└───────────────────────────────────────────────────────────┘
```

Title and badge sit on one row, 12px gap, title flexes and wraps, badge does not shrink. Badge top offset is 2px. Description sits 12px below the title row. Meta sits 12px below that.

`MetaList` is a definition list. Label is 12px medium `--muted-foreground`. Value is 14px `--foreground`, wrapping, pre-wrap. Gap is 6px inside an item and 12px between items. One column by default. Inside a card, two columns from the container’s `md`, three from its `3xl`, unless `stacked` is set. Dashboard and enrollment cards use `stacked` (one column).

`RecordList` is `grid`, `min-width: 0`, 12px gap, one column. `recordGridClass` adds two columns from `lg`. Cards in a grid stretch to equal height. Actions use `margin-top: auto`.

Do not put a card inside a card. A lesson list, video link, or grade form sits in the card’s flow, not in a nested panel. The details link covers the title, description, and meta only. Buttons and external video links stay outside that link.

`CourseListing` focus is the 2px ring with 2px offset on the link, not a second border on the card.

## 3. Dashboard layouts

Instructor `/instructor` and admin `/admin` use one column, 20px stack.

1. `PageHeader`. Title is `Welcome back, {name}`. Blank instructor name uses “Instructor”. Blank admin name uses “Admin”.
2. `BoardSection` “Submissions to grade” or “Waiting for approval”.
3. `BoardSection` “Newest courses” or “Recent enrollments”.

`BoardSection` has no card of its own. Its label is 12px semibold, uppercase, tracked, `--muted-foreground`, 8px above the region.

Each region is a `RecordList` with two columns from `lg`. Instructor submissions and courses are cards. Admin pending courses and the four newest enrollments are `CourseListing` cards. Limits stay four courses and four enrollments. The waiting-grade and waiting-approval lists are not truncated.

These regions are cards. They are not table rows. Users and reports are the dense tables. Dashboards do not show sidebar tiles, charts, count tiles, or the grade and approve forms. Empty and error states replace only the region that failed.

## 4. Tables and management lists

### DataTable

Use `DataTable` for `/admin/users` and `/admin/reports`.

| Part | Measure |
| --- | --- |
| Shell | 12px radius, 1px border, `--card`, `--shadow-raised`, 200ms |
| Header row | hidden below `md`. From `md`, `--muted` at 80% opacity, 1px bottom border |
| Header cell | 12px horizontal, 8px vertical, 12px semibold `--muted-foreground` |
| Body cell | 12px horizontal, 8px vertical, 14px `--foreground`. Heading cells are 14px medium |
| Row | 1px bottom border, none on the last row. Hover `--sage` |
| Desktop | table, min width 40rem, horizontal scroll inside the shell |
| Below `md` | each row is a stack. A 12px semibold label sits 2px above its value. The 40rem min width does not apply |

Users columns are Name, Email, Role, Created, and the promote action. Reports columns stay Course, Student, Progress, Status. The course cell is the details link. Progress is text, not a chart. Manage Users does not show phone.

### Filter toolbar

`FilterToolbar` is a column, 12px gap. From `lg` it is one row, items aligned to the end, space between. Search is flex 1, max 36rem. Label is 14px medium, 6px above the 36px input. Choice buttons sit in a wrapping row, 8px gap.

`SummaryCounts` is only on Manage Courses. Grid is two columns, three from `md`, five from `xl`, 12px gap. Each tile is the shared surface, 12px padding, left aligned. Label 12px medium muted. Count 20px semibold, tabular nums. Action 12px medium `--primary`. Selected tile uses a `--primary` border, not a role tint. Hover is `--sage` with `--foreground`.

`ResultBar` is one wrapping row, space between, 12px gap. Count is 14px `--muted-foreground`.

Search compares the trimmed query, case-insensitive, with the loaded fields below. It does not add a request, pagination, or a permission. A query that matches nothing uses that route’s “No … match this search.” sentence. Clearing the query shows the loaded rows again.

| Screen | Fields |
| --- | --- |
| Browse Courses | Course title. The category select stays a separate control. |
| Student My Courses | Course title |
| Assignments | Assignment title, course title |
| My Grades | Assignment title, course title |
| My Certificates | Course title |
| Instructor My Courses | Course title |
| Submissions | Assignment title, course title, student name |
| Manage Courses | Course title, instructor name, as `admin-manage-courses.md` already specifies |
| Manage Users | Name, email. Role choices are All, Student, Instructor, and Admin. |
| Manage Categories | Category name |
| All Enrollments | Course title, student name |
| Reports | Course title, student name |

Approve Courses, Archive Courses, lesson pages, and assignment pages have no search.

Other management lists use the record grid, not a table: browse, my courses, assignments, grades, certificates, instructor courses, lessons, assignments, submissions, categories, enrollments, approvals, and archive. A list-plus-form page puts the form panel at full width above that grid. The form does not sit in the two-column note layout.

## 5. Forms and form panels

A form panel is the 12px surface, 16px padding, 16px stack between fields. Field label is 14px medium, 8px above the control. Do not nest a second card around a field.

| Control | Measure |
| --- | --- |
| Text input | 36px, 8px radius, 12px horizontal padding, 14px type, 1px `--input`, no shadow |
| Textarea | min height 60px, same radius, border, and type. 12px horizontal, 8px vertical padding |
| Native select | same as the text input (`selectFieldClass`) |
| Primary action | 36px, 8px radius, `--primary` fill, `--shadow-raised` |
| Secondary action | outline, 36px, no raised shadow |

Create Course and AI Course Builder are the two-column forms. Below `lg`, the note stacks under the form at 20px. From `lg`, the form is `minmax(0, 2fr)` and the note is `minmax(16rem, 1fr)`, 16px gap. The note is a surface, not a tinted card.

Profile is one column, `max-w-xl`. The role badge is read-only under the fields. Create, lesson, assignment, category, and grade forms stay on their existing screens. Grade is a number input for 1 through 10 plus a textarea, inside the submission card, not a dialog.

## 6. Buttons, inputs, selects, and badges

### Button

| Variant | Fill | Hover and pressed | Shadow |
| --- | --- | --- | --- |
| Primary | `--primary` / `--primary-foreground` | `--primary-hover` | `--shadow-raised` |
| Outline | `--background`, 1px `--input` | `--sage` / `--foreground` | none |
| Secondary | `--secondary` | `--sage` / `--foreground` | none |
| Ghost | transparent | `--sage` / `--foreground` | none |
| Destructive | `--destructive` / `--destructive-foreground` | 90% of that fill | none |
| Link | `--primary` text, underline on hover | none | none |

Default size is 36px, 16px horizontal padding, 14px medium. Small is 32px, 12px horizontal, 12px type. Icon is 36px square. Icons inside buttons are 16px. `ChoiceButton` is the small button. Pressed uses primary. Unpressed uses outline. `aria-pressed` is set. The grading switch also keeps `role="tab"` and `data-state`.

### StatusBadge

Pill, 12px semibold, 10px horizontal padding, 2px vertical, 1px border, no shadow. The label is the visible status name.

| Value | Fill | Text | Border |
| --- | --- | --- | --- |
| Draft, Archived, unknown | `--muted` | `--muted-foreground` | transparent |
| Pending, Admin | `--card` | `--active` | `--active` |
| Active, Submitted, Student | `--progress-soft` | `--progress-foreground` | transparent |
| Published, Completed, Graded, Instructor | `--positive-soft` | `--positive-foreground` | transparent |

Completed uses the published green. It does not use a separate hue.

## 7. Dialogs, dropdowns, and notifications

### Dialog

Centered, max 32rem, 16px gap, 24px padding, 12px radius, 1px border, `--background`, `--shadow-raised`. Max height is `calc(100vh - 2rem)`, scroll inside. Overlay is black at 80%. Close is a 16px icon, 16px from the top and right, 8px radius, focus ring as a control. Profile edit uses this dialog from the header and does not add a second column.

### Popover

12px radius, 1px border, `--popover`, `--shadow-raised`, 12px padding. Profile menu is 16rem, align start, 8px stack. Notification menu is `min(20rem, calc(100vw - 1.5rem))`, align end, 12px collision padding. The list scrolls at max height 20rem.

### Notification bell

The button is the 36px outline icon. The unread count is a pill on the top-right, offset 4px, min 16px tall, 10px medium, `--destructive` fill, `--destructive-foreground` text. The accessible name includes the count. A row shows title 14px, body 14px, time 12px muted. Unread rows keep a 8px `--destructive` dot. Mark read is an outline button. Empty copy is “No notifications.” The success banner in the popover says “Notification marked read.”

### Success banner

Full width of the page stack, 12px radius, 1px `--border`, 12px horizontal and 8px vertical padding, 14px text. Icon is a 16px check. Dismiss is a 16px icon button with label “Dismiss”.

| Role | Background |
| --- | --- |
| Student | `--student-soft` |
| Instructor | `--instructor-soft` |
| Admin | `--admin-soft` |

Text is `--foreground`. An error replaces the banner. Dismiss does not undo the action or change the route.

## 8. Learning pages and chat

### Course learning

`/student/my-courses/$courseId` is one column, 20px stack, full content width. The back link follows `from`, as specified in `features/student/student-browse-courses.md`. A missing or unknown `from` is “Browse Courses” and goes to `/student/courses`. `my-courses` is “My Courses” and goes to `/student/my-courses`. `assistant` is “Learning Assistant” and goes to `/student/assistant`.

When the student is enrolled and the course has at least one lesson, a progress summary sits in the page stack above the first lesson. It is not a card, a chart, or an animation. The text row is 14px `--foreground`, with the count on the left and the percentage on the right. The count is “{completed} of {lesson count} lessons complete”. Completed is the number of listed lessons that already have this student’s completion. The percentage is the stored `enrollments.progress` with a percent sign, 14px semibold, tabular nums. Eight pixels below that row, the meter is the full content width, 8px tall, and 8px radius. The track is `--muted`. The fill is `--positive`, and its width is that stored percentage. The width does not transition. The meter is a progressbar. Its accessible name is the count sentence. `aria-valuenow` is the stored percentage, clamped from 0 to 100. `aria-valuetext` repeats the count and the percentage. A course with no lessons keeps the empty lesson sentence and has no meter.

Each Student My Courses card uses that same summary inside the card, below the course facts and above Open course. A course with no lessons shows “0 of 0 lessons complete” and a meter at the stored percentage. The card does not list lesson titles. The browser does not calculate a second percentage.

Each lesson is one surface, 16px padding, 12px stack, not a grid. Title is 16px medium. Content and video are a definition list, 12px between facts. Video is a `--primary` link, underline on hover, new tab, only for absolute `http` or `https`. “Mark complete” is a primary button. A finished lesson shows the word “Completed” in 14px `--foreground`.

`StudyCompanionCard` is one surface after the lessons, full width, 16px padding. Heading is “Study Companion”, 16px medium. The question is a textarea. The answer is three blocks in the same surface: explanation, example, practice questions. Practice questions are a list, 14px, 4px between items. This is not a card inside the lesson card.

### Learning Assistant

`/student/assistant` is `max-w-3xl`, one column, 20px stack. The transcript is a list, 16px between messages. Each message is a left border, 2px `--border`, 12px padding-left. Speaker is 12px medium muted. Body is 14px, pre-wrap. Course links are 14px, underline on hover, and keep `from=assistant`. Do not wrap a message in a card.

The composer is a form under the transcript, 12px stack. Label, textarea, and a primary send button. Enter sends. Shift+Enter inserts a line. Pending replaces the button state with `LoadingState` “Sending…”. An error uses `ErrorState` and restores the draft.

### Certificate

`/student/certificates/$certificateId` is `max-w-5xl`. The screen header and the Print / Download row are hidden in print. The document does not use the dark theme.

| Part | Measure |
| --- | --- |
| Paper | light `--background`, light `--foreground`, `--shadow-raised` on screen, no shadow in print |
| Outer rule | 10px, 14px from `sm`, forest `--primary` light |
| Inner rule | 2px, light `--primary-hover` |
| Inner padding | 24px, 40px horizontal and 32px vertical from `sm` |
| Wordmark | 12px semibold, uppercase, 0.28em tracking, forest |
| Title | 24px, 30px from `sm`, semibold, forest |
| Name | 24px, 30px from `sm`, semibold |
| Course | 20px, 24px from `sm`, semibold |
| Seal | 80px, 96px from `sm`, circle, 4px forest border, 10px / 12px from `sm` |
| Aspect | 11 / 8.5 |

The PDF uses the same paper, forest rules, forest wordmark and seal, and light `--foreground` for the body. Fields stay those in `features/student/student-certificates-and-notifications.md`.

## 9. Empty, loading, error, and success

All four use 12px radius. Empty and loading use `--card`, 1px `--border`, and `--shadow-raised`. Error does not use the raised shadow.

| State | Layout | Type |
| --- | --- | --- |
| Loading | row, 8px gap, 12px horizontal, 8px vertical | 16px spinner, 14px muted |
| Empty | 16px padding. 16px inbox icon, 8px gap, icon aligned to the first line | 14px muted. Actions wrap with 8px gap |
| Error | row, 8px gap, 12px horizontal, 8px vertical, `role="alert"` | 16px alert icon, 14px `--destructive`, border `--destructive` at 30%, fill `--destructive` at 10% |
| Success | the banner in section 7 | 14px `--foreground` |

Empty copy stays the sentence already on that screen. Do not invent a friendlier replacement.

| Route | Empty sentence |
| --- | --- |
| `/student/courses` | “No published courses are available.” Search: “No courses match this search.” Category: “No published courses are in this category.” |
| `/student/my-courses` | “You are not enrolled in any courses.” Link “Browse Courses”. Search: “No courses match this search.” |
| `/student/my-courses/$courseId` | “This course is not available.” “Lessons are hidden until you enroll.” “This course has no lessons yet.” |
| `/student/assistant` | “Ask about a course, a recommendation, your grades, or the next course to take.” |
| `/student/assignments` | “You have no assignments.” Link “Browse Courses”. Search: “No assignments match this search.” |
| `/student/grades` | “You have no grades yet.” Link “Assignments”. Search: “No grades match this search.” |
| `/student/certificates` | “You have no certificates yet.” Search: “No certificates match this search.” |
| `/student/certificates/$certificateId` | “This certificate is not available.” |
| `/instructor` | “No submissions to grade.” “You have no courses yet.” |
| `/instructor/courses` | “You have no courses yet.” Link to Create Course. Search: “No courses match this search.” |
| `/instructor/courses/$courseId/lessons` | “This course is not available.” “This course has no lessons yet.” |
| `/instructor/courses/$courseId/assignments` | “This course is not available.” “This course has no assignments yet.” |
| `/instructor/submissions` | “No submissions to grade.” “No graded submissions.” Search: “No submissions match this search.” |
| `/admin` | “No courses are waiting for approval.” “There are no enrollments yet.” |
| `/admin/courses` | `adminCourseEmptyMessage` in `manage-courses.ts` |
| `/admin/courses/approvals` | “No courses are waiting for approval.” |
| `/admin/courses/archive` | “No published courses are available to archive.” |
| `/admin/users` | “There are no users yet.” Search: “No users match this search.” |
| `/admin/categories` | “There are no categories yet.” Search: “No categories match this search.” |
| `/admin/enrollments` | “There are no enrollments yet.” Search: “No enrollments match this search.” |
| `/admin/reports` | “There are no enrollments yet.” Search: “No enrollments match this search.” |
| Header bell | “No notifications.” |

## Page layouts

| Layout | Width | Columns | Placement |
| --- | --- | --- | --- |
| Public landing | max 72rem, 24px side padding | 1, then 2 from `sm` and 3 from `lg` for cards. Steps are 5 from `lg` | Header, hero, role cards, agent cards, steps, after-enrollment cards, footer |
| Auth card | 28rem, centered on the viewport | 1 | Title, form, Google, mode switch |
| Signed-in list | full inset | 1, records 2 from `lg` | Header, banner, filters, grid or table |
| Signed-in dashboard | full inset | 1, records 2 from `lg` | Header, two board sections |
| Two-column form | full inset | 1, then 2fr / 1fr from `lg` | Header, banner, form, note |
| List plus form | full inset | form 1, records 2 from `lg` | Header, banner, full-width form, then the record grid |
| Narrow work | `max-w-xl`, `max-w-3xl`, or `max-w-5xl` | 1 | Header, then profile, chat, or certificate |
| Table page | full inset | 1 | Header, filters, one table shell |

## Routes

Sidebar labels and behavior links are the source of truth. Visual acceptance is what must be true after the layout is applied.

### Public

| Route | Layout | Components | Acceptance |
| --- | --- | --- | --- |
| `/` | Public landing | Landing surfaces, role chips, primary and outline controls | No shell. Tokens match section 1. Role cards link to the existing role homes. Footer sentence stays. |
| `/auth` | Auth card | Inputs, primary, outline, `ErrorState` | Heading “Sign in” or “Create account”. Helper “New accounts are students.” Email and password required. Google stays. New accounts remain students. |
| Profile error | Auth card | `ErrorState`, Log out | No sidebar. |
| 404 and root error | Centered 28rem text, no card required for the 404 title | Primary and outline links | 404 title stays “Page not found”. Error title stays “This page didn't load”. |

`/student` has no screen. It redirects to `/student/courses`.

### Student

Shell: student navigation. Banner tint: `--student-soft`.

| Route | Layout | Components | Acceptance |
| --- | --- | --- | --- |
| `/student/courses` | Signed-in list | `PageHeader`, `FilterToolbar`, category `selectFieldClass`, `CourseListing` | Heading “Browse Courses”. No back link. Search and category filter. Enroll and Open course stay outside the details link. See `features/student/student-browse-courses.md`. |
| `/student/courses/$courseId` | Signed-in list, one record | `PageHeader`, one details surface, `MetaList`, `StatusBadge` | Back target comes from `from`. Student status uses `statusShownToStudent`. This page does not list lessons. Open course, when enrolled, opens the learning view and copies `from`. See `features/course-details.md`. |
| `/student/my-courses` | Signed-in list | `PageHeader`, `FilterToolbar`, `CourseListing`, progress summary | Heading “My Courses”. Each enrolled card shows the completion count and stored progress meter. Open course goes to the learning route. Certificate sentence stays on a completed card. See `features/student/student-my-courses.md`. |
| `/student/my-courses/$courseId` | Learning column | `PageHeader`, progress summary, lesson surfaces, material list, `StudyCompanionCard`, `SaveNotice` | Back link follows `from`. Enrolled courses with lessons show the completion count and stored progress. Mark complete, video link, material download, and companion stay. No upload. See `features/student/student-browse-courses.md` and `features/student/student-lesson-completion.md`. |
| `/student/assistant` | Narrow work, `max-w-3xl` | `PageHeader`, transcript list, composer | Heading “Learning Assistant”. No nested message cards. Course links keep `from=assistant`. See `features/student/student-learning-assistant.md`. |
| `/student/assignments` | Signed-in list | `PageHeader`, `FilterToolbar`, `RecordCard`, submit form | Heading “Assignments”. One submission form per open assignment. See `features/student/student-assignment-submission.md`. |
| `/student/grades` | Signed-in list | `PageHeader`, `FilterToolbar`, `RecordCard` | Heading “My Grades”. No grade form. Empty links to Assignments. See `features/student/student-my-grades.md`. |
| `/student/certificates` | Signed-in list | `PageHeader`, `FilterToolbar`, `RecordCard` | Heading “My Certificates”. View Certificate is the only action. See `features/student/student-certificates-and-notifications.md`. |
| `/student/certificates/$certificateId` | Narrow work, `max-w-5xl` | `PageHeader`, Print, Download PDF, certificate document | Back link “My Certificates”. Print hides chrome. Document colors match section 8. |
| `/student/profile` | Narrow work, `max-w-xl` | `PageHeader`, one form surface, `StatusBadge` | Heading “My Profile”. Fields are name, email, and phone. Role is not an input. See `features/student/student-profile.md`. |

### Instructor

Shell: instructor navigation. Banner tint: `--instructor-soft`.

| Route | Layout | Components | Acceptance |
| --- | --- | --- | --- |
| `/instructor` | Dashboard | `PageHeader`, two `BoardSection`s, `RecordCard`, `CourseListing` | Greeting and the two regions in section 3. No grade form. See `product.md`. |
| `/instructor/courses/new` | Two-column form | `PageHeader`, form surface, note surface, `CategorySelect` | Heading “Create Course”. Back link “Instructor Dashboard”. See `features/instructor/instructor-course-creation.md`. |
| `/instructor/courses/generate` | Two-column form, then a preview | `PageHeader`, form surface, preview surfaces, `StatusBadge` | Heading “AI Course Builder”. Back link “Instructor Dashboard”. Save still creates a draft and does not submit it. See `features/instructor/instructor-ai-course-builder.md`. |
| `/instructor/courses` | Signed-in list | `PageHeader`, `FilterToolbar`, course surfaces, lesson editor | Heading “My Courses”. No back link. See `features/instructor/instructor-my-courses.md`. |
| `/instructor/courses/$courseId` | Signed-in list, one record | `PageHeader`, details surface, `InstructorCourseLinks` | Back target comes from `from`. Lessons, Materials, and Assignments links stay. See `features/course-details.md`. |
| `/instructor/courses/$courseId/lessons` | List plus form | `PageHeader`, create form, lesson grid | Back link “My Courses”. No search. The form is shown only while the course is `draft`. See `features/instructor/instructor-my-courses.md`. |
| `/instructor/courses/$courseId/materials` | List plus form | `PageHeader`, file input, file list | Back link “My Courses”. No search. The file input is shown only while the course is `draft`. See `features/instructor/instructor-course-materials.md`. |
| `/instructor/courses/$courseId/assignments` | List plus form | `PageHeader`, create form, assignment surfaces | Same back link. No search. The form is shown only while the course is `draft`. See `features/instructor/instructor-assignment-management.md`. |
| `/instructor/submissions` | Signed-in list | `PageHeader`, `FilterToolbar`, `ChoiceButton` pair, submission cards, grade form | Heading “Submissions”. To Grade and Graded stay. See `features/instructor/instructor-grading.md`. |
| `/instructor/profile` | Narrow work, `max-w-xl` | Same profile form as the student page | Heading “Profile”. See `features/instructor/instructor-profile.md`. |

### Admin

Shell: admin navigation. Banner tint: `--admin-soft`.

| Route | Layout | Components | Acceptance |
| --- | --- | --- | --- |
| `/admin` | Dashboard | `PageHeader`, two `BoardSection`s, `CourseListing` | Greeting and the two regions in section 3. No approve control. See `product.md`. |
| `/admin/courses` | Signed-in list | `PageHeader`, `FilterToolbar`, `ChoiceButton`s, `SummaryCounts`, `ResultBar`, `CourseListing` | Heading “Course Management”. No back link. Count tiles filter. Approve and Archive stay outside the details link. A pending card can show an advisory review. That review does not hide Approve. See `features/admin/admin-manage-courses.md`. |
| `/admin/courses/$courseId` | Signed-in list, one record | `PageHeader`, details surface | Back target comes from `from`. Admin sees instructor and lessons. See `features/course-details.md`. |
| `/admin/courses/approvals` | Signed-in list | `PageHeader`, text link, pending cards | Heading “Approve Courses”. Back link “Manage Courses”. Link “Archive a published course”. Review with AI sits on the pending card and does not hide Approve. See `features/admin/admin-approve-courses.md`. |
| `/admin/courses/archive` | Signed-in list | `PageHeader`, published cards | Heading “Archive Courses”. Back link “Manage Courses”. See `features/admin/admin-archive-course.md`. |
| `/admin/users` | Table page | `PageHeader`, `FilterToolbar`, `ChoiceButton`s, `DataTable`, `StatusBadge` | Heading “Manage Users”. One row per profile. Promote stays on a student row that is not the signed-in admin. See `features/admin/admin-manage-users.md`. |
| `/admin/categories` | List plus form | `PageHeader`, `FilterToolbar`, create form, category cards | Heading “Manage Categories”. See `features/admin/admin-manage-categories.md`. |
| `/admin/enrollments` | Signed-in list | `PageHeader`, `FilterToolbar`, `CourseListing` | Heading “All Enrollments”. No form. See `features/admin/admin-all-enrollments.md`. |
| `/admin/reports` | Table page | `PageHeader`, `FilterToolbar`, `DataTable` | Heading “Reports”. Newest first. Course cell opens details. No counts or charts. See `product.md`. |

## Acceptance

These hold in light and dark. The certificate document stays on the light tokens in both themes.

- Text and control labels meet 4.5:1 against their fill. The focus ring, the progress meter, and other non-text boundaries meet 3:1. Do not add a token when a check fails.
- A status badge keeps its text label. The unread bell keeps a count in its accessible name. Color is not the only signal.
- Every shared control has default, hover, focus-visible, pressed, and disabled. Focus-visible is a 2px `--ring` with 2px offset. Disabled is 50% opacity and does not change color on hover. Pressed primary uses `--primary-hover`.
- The theme control stores `light` or `dark` in `localStorage` under `eduhub-theme` and sets `dark` on `html`. The default is light. The same choice remains after refresh and navigation, on public and signed-in pages.
- `prefers-reduced-motion: reduce` sets the 150ms and 200ms transitions to 0ms. The progress meter does not animate in either setting.
- An icon-only control keeps an accessible name. Dismiss is named “Dismiss”.
- A role cannot open another role’s routes or gain an action its feature spec withholds. Search and role choices filter rows already loaded. They do not change the query or who may write.

## Resolved decisions

1. Dashboard courses, enrollments, and submissions stay cards. Users and reports stay `DataTable`.
2. Manage Users is one `DataTable` row per profile. It is not a card grid.
3. The instructor sidebar, the page headings, and the lesson and assignment back links use “My Courses” and “Submissions”.
4. The public landing hero stays 30px, 36px from `sm`. Signed-in page titles stay 20px, 24px from `sm`.
5. The learning view shows the completion count and the stored enrollment progress. Its back link follows `from`. The meter is not animated. Each Student My Courses card shows that same count and meter, including a course with no lessons.
