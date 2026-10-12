# Student My Profile

Specifies the student’s own profile editor. The instructor editor is the same screen, specified in `../instructor/instructor-profile.md`. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009133000_create_profiles.sql`.

This feature does not add a table, column, policy, route, or migration.

## Route

`/student/profile` is My Profile. The heading is “My Profile”. It is a sidebar item, so it has no back link. The existing file route stays in place. Do not add a profile-detail route.

## Schema and RLS

No schema change and no RLS change. The applied rules already cover this screen:

| Need                         | What already exists                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Read their own profile       | `profiles_select_own` returns a row only when `id` is the session user. `getOwnProfile` already selects `id`, `email`, `full_name`, `phone`, and `role`.                                                                                                                                         |
| Edit name, email, and phone  | `grant update (full_name, email, phone)` and `profiles_update_own` allow an update only when `id` is the session user. All three columns are nullable text. There is no format check and no length limit.                                                                                        |
| Role stays fixed             | `role` is not in the update grant. `prevent_profile_role_change` rejects a role change while `auth.uid()` is not null. A signed-in user does not edit `profiles.role`.                                                                                                                           |
| Sign-in email stays separate | `profiles.email` is copied from the auth user at signup. Changing it does not change `auth.users`. This screen does not call `auth.updateUser`. The layout still shows `profiles.email`, and falls back to the sign-in email only when the profile email is blank. That fallback stays as it is. |

Do not add a password column, an avatar column, or an admin update policy.

## Editor

The student and instructor routes render one shared editor in `features/auth/`. The route stays thin and passes the session user id. Read and update with the signed-in browser client from `@/integrations/supabase/client`. Do not use the service-role client. Do not filter the update to a different user.

Load through the existing `getOwnProfile`. Show the stored `full_name`, `email`, and `phone`. A null value is an empty field. Do not fill a blank profile email with the sign-in email.

The update sends only `full_name`, `email`, and `phone`. Trim each value. A blank value is stored as null, never `""`. Do not send `role`, `id`, or `created_at`.

Role is read-only text, “Student” on this screen. It is not an input.

## UI

Follow the visual direction in `product.md`. Use `PageHeader` and one white bordered card. Do not add a second column. Reuse `SaveNotice`.

Name, email, and phone are not marked required. The schema does not require them.

- **Loading.** The form is not shown yet. Do not offer save.
- **Ready.** The fields show the loaded profile. The save control is available.
- **Saving.** The save control does not send a second update.
- **Saved.** Stay on this screen. Keep the saved values, trimmed. Show a success banner: “This profile was saved.” The banner can be dismissed. Dismissing it does not undo the save or leave the page. Refresh the role layout session so the header name and profile email match the saved row. A blank profile email still uses the existing header fallback.
- **Load error.** Show the Supabase error, or the existing missing-profile message. Do not show the form and do not offer save.
- **Save error.** Show the Supabase error inline. Leave the entered values in place. An error replaces the success banner.

## Authorization

The student layout already calls `requireRole("student")`. An instructor or admin is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

RLS is the data boundary. A hidden control is not enough. Do not hand-edit `src/integrations/supabase/types.ts`.

## Out of scope

- Changing the sign-in email, password, or Google identity.
- Changing `profiles.role`, including promotion to instructor.
- Admin profile editing. The admin sidebar has no Profile item.
- Other users’ profiles.

## Acceptance criteria

- A student can save a trimmed name, email, and phone on their own profile. A blank field is stored as null.
- The update contains only `full_name`, `email`, and `phone`.
- The form shows a blank profile email as blank. It does not copy in the sign-in email.
- Role is shown as Student and is not an input. The save does not send `role`.
- After a successful save, the saved values stay on the screen, the success banner is shown, and the layout session is refreshed. Dismissing the banner stays on this page.
- A failed load shows the error and does not offer save. A failed save shows the error, keeps the entered values, and does not claim the profile was saved.
- No table, column, policy, or migration is added.
- An instructor or admin does not get this screen.
