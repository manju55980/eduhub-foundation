# Product

EduHub is a small learning management system for the SJ Innovation Week 1 assignment. Requirements are in `EduHub_Assignment1_Requirements.md`. Email/password and Google sign-in, session handling, and the three role shells are in place. Create Course can save a draft. My Courses lists that instructor’s courses and lessons, and submits a draft that has a lesson so its status becomes `pending`. Browse Courses lists published courses, enrolls the student, and shows lessons after enrollment. Student My Courses lists the courses that student has joined. Approve Courses lists those pending courses and publishes one. Archive Courses lists published courses and archives one. An instructor can create and edit assignments for a course they own. A student can view those assignments, submit once, and read their own grades. An instructor can grade a submission for a course they own. An admin can view every enrollment. A student or instructor can edit their own profile name, email, and phone. Manage Users lists every profile and can promote another student to instructor. Manage Categories lists categories and can create, rename, and delete one. An instructor can choose an optional category when creating a course or editing a draft. Browse Courses can filter published courses by category. Reports lists every enrollment. Instructor Dashboard lists submissions waiting to be graded and the four newest courses. Admin Dashboard lists courses waiting for approval and the four newest enrollments. An enrolled student can ask the study companion for an explanation, an example, and practice questions on that course. An instructor can generate a course outline and save it as a new draft with lessons and assignments. The first two migrations are applied on the remote project. `profiles_select_instructor_submission`, `promote_student_to_instructor`, and `supabase/migrations/20261010233000_create_categories.sql` are local and have not been applied.

## Roles

| Role       | How someone gets it                                                               |
| ---------- | --------------------------------------------------------------------------------- |
| Student    | Default for every new user                                                        |
| Instructor | An Admin promotes an existing user                                                |
| Admin      | The first Admin is configured manually in Supabase. No in-app “become admin” flow |

There is no self-serve role picker. `profiles.role` stores `student`, `instructor`, or `admin`. A user does not edit that column.

## Decisions already made

- Three roles: Student, Instructor, and Admin.
- New users are Student by default.
- An Admin can promote a user to Instructor.
- A category has `id`, `name`, and `created_at`. A course has at most one category, in optional `courses.category_id`. An admin creates, renames, and deletes categories. An unused category is the only row that can be hard-deleted. An instructor selects a category on create and on a draft. A student filters published courses by category. See `features/admin/admin-manage-categories.md`. The migration is local and has not been applied.
- The first Admin is set manually in Supabase.
- The role lives on `profiles.role`. No separate roles table is specified.
- A security-definer trigger on `auth.users` insert creates the profile and always sets `role` to `student`. Signup metadata cannot set a role.
- A signed-in user cannot change their own `profiles.role`. An admin can promote a different student to instructor through `promote_student_to_instructor`. No other role change is available in the app. The first Admin is still set with a manual Supabase update that has no user JWT.
- Login is required for dashboards.
- Sign-in is email/password and Google.
- Core assignment behavior comes before bonus features.
- A new course starts as `draft`. The owning instructor submits it for approval, which sets `pending`.
- An admin can publish a `pending` course, or archive a `published` course. Archived courses are hidden from new enrollments. Students who already enrolled keep access to the course, its lessons, and its assignments.
- `submissions.grade` stays text. No grading scale is defined.
- `enrollments.progress` is a percentage from 0 to 100. It starts at 0. Status becomes `completed` at 100 and is `active` otherwise, through `enrollments_sync_status`. The assignment does not say who updates progress after enrollment. No screen updates it. Do not calculate it from lessons or submissions.
- A submission is text or a link in `content_url`. There is no file-storage bucket.
- A student can enroll in the same course only once.
- A student can submit each assignment only once.
- Admins can read grades. Only the course instructor can change a grade, feedback, or submission status.
- Rows are not hard-deleted, except an unused category. A category that any course references cannot be deleted. Archiving is how a course leaves the catalogue.
- The AI bonus adds no table and no column. Study answers are not stored. Practice questions are not inserted into `assignments` or `submissions`. Course Builder Save creates one new `draft` course, then its lesson rows, then its assignment rows. Those inserts are separate statements, not one transaction. If a later insert fails, the draft stays and the screen shows that course so the instructor can finish it on the existing lesson and assignment screens. Save does not set `pending`. The edited preview is validated before any insert. The Gemini key is only the Edge Function secret `GEMINI_API_KEY`.

## Who can do what

**Student.** Browse published courses, filter them by category, and enroll. View lessons for enrolled courses. Ask the study companion about an enrolled course. Submit assignments. View their own enrollments, grades, and feedback. No access to another student’s private records or grades.

**Instructor.** Create and manage their own courses and lessons. Choose an optional category while creating a course or editing a draft. Generate a new draft course from a short brief. Submit a draft course for approval. Review and grade submissions for their own courses.

**Admin.** Review and publish courses, and archive a published course. Manage users. Create, rename, and delete categories. View all enrollments and read grades. Admins do not change grades.

## Navigation

Each role’s sidebar lists only that role’s pages. Paths below are the recorded route map for those items.

| Area       | Path                                        | Sidebar                                                         |
| ---------- | ------------------------------------------- | --------------------------------------------------------------- |
| Public     | `/`                                         | Entry                                                           |
| Public     | `/auth`                                     | Sign-in                                                         |
| Student    | `/student/courses`                          | Browse Courses                                                  |
| Student    | `/student/my-courses`                       | My Courses                                                      |
| Student    | `/student/my-courses/$courseId`             | Lessons for an enrolled course (no separate sidebar item)       |
| Student    | `/student/assignments`                      | Assignments                                                     |
| Student    | `/student/grades`                           | My Grades                                                       |
| Student    | `/student/profile`                          | My Profile                                                      |
| Instructor | `/instructor`                               | Instructor Dashboard                                            |
| Instructor | `/instructor/courses/new`                   | Create Course                                                   |
| Instructor | `/instructor/courses/generate`              | AI Course Builder                                               |
| Instructor | `/instructor/courses`                       | My Courses (including lessons)                                  |
| Instructor | `/instructor/courses/$courseId/lessons`     | Lessons for one of their courses                                |
| Instructor | `/instructor/courses/$courseId/assignments` | Assignments for one of their courses (no separate sidebar item) |
| Instructor | `/instructor/submissions`                   | Submissions (grading)                                           |
| Instructor | `/instructor/profile`                       | Profile                                                         |
| Admin      | `/admin`                                    | Admin Dashboard                                                 |
| Admin      | `/admin/courses/approvals`                  | Approve Courses                                                 |
| Admin      | `/admin/courses/archive`                    | Archive a published course (no separate sidebar item)           |
| Admin      | `/admin/users`                              | Manage Users, including promotion to Instructor                 |
| Admin      | `/admin/categories`                         | Manage Categories                                               |
| Admin      | `/admin/enrollments`                        | All Enrollments                                                 |
| Admin      | `/admin/reports`                            | Reports                                                         |

Profile fields a person can edit are `full_name`, `email`, and `phone`.

Create Course is specified in `features/instructor/instructor-course-creation.md`. Instructor My Courses and lesson management are specified in `features/instructor/instructor-my-courses.md`. Instructor assignment management is specified in `features/instructor/instructor-assignment-management.md`. Instructor grading is specified in `features/instructor/instructor-grading.md`. Student Browse Courses, enrollment, and the enrolled course learning view are specified in `features/student/student-browse-courses.md`. Student My Courses is specified in `features/student/student-my-courses.md`. Student assignment submission is specified in `features/student/student-assignment-submission.md`. Student My Grades is specified in `features/student/student-my-grades.md`. Admin Approve Courses is specified in `features/admin/admin-approve-courses.md`. Admin Archive Course is specified in `features/admin/admin-archive-course.md`. Admin All Enrollments is specified in `features/admin/admin-all-enrollments.md`. Admin Manage Users is specified in `features/admin/admin-manage-users.md`. Admin Manage Categories is specified in `features/admin/admin-manage-categories.md`. Student My Profile is specified in `features/student/student-profile.md`. Instructor Profile is specified in `features/instructor/instructor-profile.md`. The study companion is specified in `features/student/student-ai-study-companion.md`. AI Course Builder is specified in `features/instructor/instructor-ai-course-builder.md`.

Reports lists every enrollment, newest first, with the course, student, progress, and status. It does not repeat sidebar links, counts, or charts. Instructor Dashboard greets the signed-in instructor by name, or “Instructor” when the name is blank. It lists every submission waiting to be graded and the four newest courses. It does not repeat sidebar links, counts, or charts, and it does not grade a submission. Admin Dashboard greets the signed-in admin by name, or “Admin” when the name is blank. It lists every course waiting for approval and the four newest enrollments. It does not repeat sidebar links, counts, or charts, and it does not approve a course. Category records are specified in `features/admin/admin-manage-categories.md`.

## Core workflow

1. An instructor creates a course. It starts as `draft` and is not publicly available. Submitting it sets `pending`.
2. An admin publishes a `pending` course. An admin can later archive a `published` course. Archived courses do not accept new enrollments. Existing students keep access.
3. A student browses published courses and enrolls once. Progress starts at 0 and status is `active`. It becomes `completed` when progress reaches 100.
4. The student views lessons and submits an assignment once, as text or a link. The submission status becomes `submitted`.
5. The instructor grades that submission, adds feedback, and the status becomes `graded`.
6. The student can view their own grade and feedback.
7. The admin can oversee platform activity, including reading grades. Admins do not change grades.

## Priority

Build this path before bonus work or unspecified pages:

1. Email/password and Google sign-in, a `profiles` row, and the default Student role.
2. Role-aware routing and the three sidebars.
3. Course creation, lesson management, and admin publish. Unpublished courses stay hidden.
4. Enrollment, lesson viewing, and assignment submission.
5. Instructor grading and the student’s own grade view.
6. RLS so users cannot read other users’ private rows, including other students’ grades.

Then deploy the GitHub repo to Vercel, set the Supabase URL and publishable key, configure Google redirect URLs, and test all three roles on the live URL. The submission needs working login credentials for Student, Instructor, and Admin.

## Bonus

Only after the core path works:

- Animated course progress tracker
- AI Study Companion and AI Course Builder. See `features/student/student-ai-study-companion.md` and `features/instructor/instructor-ai-course-builder.md`.

## Unresolved

Do not guess these:

- Category name length, and whether two names that differ only by case are duplicates. `name` is unique after trim. No length limit is specified.
- How `enrollments.progress` changes after it starts at 0. The assignment does not specify a manual update or an automatic calculation. No screen updates progress. The stored display and `enrollments_sync_status` stay as they are.
- Creating another Admin, demotion, and any role change other than Student to Instructor. Those stay blocked. See `features/admin/admin-manage-users.md`.
- Rejecting a `pending` course, and restoring an `archived` course. Those transitions are not specified.

## Visual direction

A Jira-inspired workspace: sharp panels, subtle borders, compact spacing, and a blue-and-neutral palette. Tokens and component rules are in `guides/frontend.md`. Future pages follow that guide.

- **Shell.** White sidebar with the EduHub wordmark, a graduation-cap mark, a Menu group, and a short footer line: “Better learning builds brighter futures.” The active item uses the sidebar accent. The header shows the signed-in name, email, and role, with Log out on the right.
- **Page.** A clear title, an optional muted description, and an optional text back link. One main column. A second column only when the page has supporting content, as Create Course does.
- **Records.** A card for a summary, a described record, or a form. A table for a dense list. Course, enrollment, submission, and role values use a badge. Editors stay forms. Do not nest a card inside a card.
- **States.** Loading, empty, and error use one shared treatment. Empty copy stays the sentence already specified for that screen, with its existing link when the screen has one.
- **Feedback.** Success is a dismissible banner in the signed-in role’s soft tint, with a check. Errors are a bordered alert and replace the banner. Dismissing a banner does not undo the action or change the route.
