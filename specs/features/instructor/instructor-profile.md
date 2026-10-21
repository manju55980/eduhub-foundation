# Instructor Profile

Specifies the instructor’s own profile editor. The fields, payload, and states are the student editor in `../student/student-profile.md`. This file records only the instructor route. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009133000_create_profiles.sql`.

This feature does not add a table, column, policy, route, or migration.

## Route

`/instructor/profile` is Profile. The heading is “Profile”. It is no longer a sidebar item. The header avatar opens the shared editor in a modal. A direct visit to the route still renders the page. The existing file route stays in place. Do not add a profile-detail route.

The route renders the same `features/auth/` editor as My Profile. Do not copy the form into `features/instructor/`.

## Differences from My Profile

| Student My Profile                     | Instructor Profile                        |
| -------------------------------------- | ----------------------------------------- |
| Route `/student/profile`               | Route `/instructor/profile`               |
| Heading “My Profile”                   | Heading “Profile”                         |
| Role text “Student”                    | Role text “Instructor”                    |
| `requireRole("student")` on the layout | `requireRole("instructor")` on the layout |

Everything else in `student-profile.md` applies here: load through `getOwnProfile`, edit only `full_name`, `email`, and `phone`, store a blank as null, do not send `role`, do not change the sign-in email, and refresh the layout session after a successful save.

## Authorization

The instructor layout already calls `requireRole("instructor")`. A student or admin is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

`profiles_update_own` still limits the update to the session user. Do not add an instructor-only profile policy.

## Out of scope

The student profile out-of-scope list applies. Course, lesson, assignment, and grading screens stay unchanged.

## Acceptance criteria

- An instructor uses the shared editor on `/instructor/profile`, with the heading “Profile” and the role text “Instructor”.
- The save rules, blank-as-null rule, read-only role, sign-in email boundary, banner, and session refresh are the ones in `student-profile.md`.
- A student or admin does not get this screen.
- No table, column, policy, or migration is added.
