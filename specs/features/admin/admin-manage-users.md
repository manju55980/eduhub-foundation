# Admin Manage Users

Specifies Manage Users. Publishing stays in `admin-approve-courses.md`. Archiving stays in `admin-archive-course.md`. A person’s own profile editor stays in `../student/student-profile.md` and `../instructor/instructor-profile.md`. Roles and the route map stay in `product.md`.

The profile columns stay in `supabase/migrations/20261009133000_create_profiles.sql`. This feature’s only database change is `supabase/migrations/20261010230000_promote_student_to_instructor.sql`. That migration is local and has not been applied. It does not add a table or column, and it does not grant `UPDATE` on `role`.

## Route

`/admin/users` is Manage Users. The heading is “Manage Users”. It is a sidebar item, so it has no back link. The existing file route stays in place. Do not add a user-detail route. Each profile is a card.

## Schema and RLS

| Need                   | Rule                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read every profile     | `profiles_select_admin` already returns every profile when `current_app_role()` is `admin`. This screen selects `id`, `full_name`, `email`, `role`, and `created_at`. It does not select `phone`.                                                                               |
| Promote                | `promote_student_to_instructor(target_id uuid)` is `SECURITY DEFINER` with an empty `search_path`. `EXECUTE` is granted to `authenticated` only. The function raises unless `current_app_role()` is `admin`, `target_id` is not `auth.uid()`, and that row’s role is `student`. |
| What the update writes | The function sets `role` to `instructor` and no other column.                                                                                                                                                                                                                   |
| Trigger                | `prevent_profile_role_change` still rejects a signed-in role change. It allows one case: the caller is an admin, the row is not the caller, the role moves from `student` to `instructor`, and `id`, `full_name`, `email`, `phone`, and `created_at` are unchanged.             |
| Manual first admin     | A role change with `auth.uid()` null still passes the trigger. That is the existing manual Supabase update. This screen does not use it.                                                                                                                                        |
| Own profile fields     | `profiles_update_own` and `grant update (full_name, email, phone)` stay as they are. There is no admin update policy.                                                                                                                                                           |
| Repeated promotion     | A second call finds the row is already `instructor` and raises.                                                                                                                                                                                                                 |
| Other transitions      | Student to admin, instructor to student, and any change to or from `admin` raise. A student or instructor who calls the function raises.                                                                                                                                        |
| Service role           | The screen uses the signed-in browser client from `@/integrations/supabase/client`. It does not use the service-role client or `SUPABASE_SERVICE_ROLE_KEY`.                                                                                                                     |

`current_app_role()` reads the caller’s profile, not the row being updated, so the trigger does not recurse.

A promoted person has one role. Existing enrollment rows stay. Student policies require `current_app_role() = 'student'`, so that person uses the instructor shell afterward. This feature does not delete those rows.

## Listing

The route stays thin and passes the session user id. The query lives in `features/admin/`. Do not filter the query to the signed-in admin.

List every profile, newest `created_at` first, including the signed-in admin. The assignment does not specify an order. This is the same order as the other admin lists.

Each card shows the stored `full_name`, `email`, `role`, and `created_at`. A null name or email is blank. Do not substitute a made-up name. Role is the stored `student`, `instructor`, or `admin` value. Do not list phone, courses, enrollments, grades, or submissions.

If the profile query fails, show that error and do not show cards or Promote. An empty result says “There are no users yet.” It is not sample users, and it has no Promote control.

## Promote

Show Promote only when the card’s role is `student` and the card’s id is not the session user. The signed-in admin, an instructor, and another admin have no Promote control.

Promote calls `promote_student_to_instructor` with that profile id as `target_id`. It does not send `role` or any other column through a table update.

- **Loading.** The list is not shown yet. Do not offer Promote.
- **Ready.** Each other student has Promote.
- **Promoting.** That control does not send a second call.
- **Promoted.** Stay on this screen. That card’s role becomes Instructor and Promote leaves that card. The banner says “This user was promoted to instructor.” It can be dismissed. Dismissing it does not change the role back or change the route.
- **Error.** Show the database error inline. An error replaces the success banner. The card’s role stays what it was.

Until the migration is applied, the call fails and the screen shows that error. Do not claim the user was promoted.

## Authorization

The admin layout already calls `requireRole("admin")`. A student or instructor is redirected before this screen mounts. A missing profile still uses that layout’s profile error.

The function and the trigger are the data boundary. A hidden button is not enough. Do not hand-edit `src/integrations/supabase/types.ts` beyond the function entry that matches this migration. Regenerate that file from the database after the migration is applied.

## Out of scope

- Creating another admin, demotion, and any role change other than student to instructor.
- Editing another person’s `full_name`, `email`, or `phone`.
- Changing the sign-in email, password, or Google identity.
- Creating, deleting, or disabling a user.
- Categories, reports, and the admin dashboard.

## Acceptance criteria

- An admin sees every profile, newest `created_at` first, including their own.
- Each card shows the stored name, email, role, and profile created time. Phone, courses, enrollments, grades, and submissions are not shown.
- Promote is offered only for another user’s `student` row. It calls `promote_student_to_instructor` with that id.
- An authorized promotion sets that row’s role to `instructor` and changes no other column. The card shows Instructor and loses Promote. The banner can be dismissed without undoing it.
- A student or instructor caller, a self-target, a target who is not a student, and a repeated promotion each raise and do not change the role.
- A failed call shows the error and leaves the card’s role unchanged.
- The screen does not use the service role. It has no demote, delete, invite, or profile-edit control.
- No table or column is added. `UPDATE` on `role` is not granted.
- A student or instructor does not get this screen.
