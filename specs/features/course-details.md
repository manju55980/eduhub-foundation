# Course details

Specifies the shared course details page. Listing, enrollment, approval, and archive behavior stay in their own feature specs. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md`.

This feature does not add a table, column, policy, or migration. It does not add a sidebar item.

## Routes

| Path                             | Who        | Back link                                                                 |
| -------------------------------- | ---------- | ------------------------------------------------------------------------- |
| `/student/courses/$courseId`     | Student    | Browse Courses, My Courses, or Learning Assistant, from `from`            |
| `/instructor/courses/$courseId`  | Instructor | My Courses, Instructor Dashboard, or AI Course Builder, from `from`       |
| `/admin/courses/$courseId`       | Admin      | Approve Courses, Archive Courses, Admin Dashboard, All Enrollments, or Reports, from `from` |

`from` is a search param. An unknown value falls back to Browse Courses, My Courses, or Approve Courses for that role. These routes sit beside the existing learning, lessons, and assignments routes. They do not replace them.

The signed-in layout already calls `requireRole` for that area. The page reads with the signed-in browser client from `@/integrations/supabase/client`. The route stays thin. The query lives in `features/courses/`. Do not use the service-role client. A course RLS does not return is “This course is not available.”

## What the page shows

The heading is the stored title, or “Course” when the title is blank. The page shows status, level, category, created date, and description. A null description is blank. Do not substitute a made-up name. For a student, a `published` course whose own enrollment status is `completed` shows Completed in place of Published. Instructor and admin pages still show the stored course status. The stored status is not changed.

| Audience   | Extra fields                                      | Actions on this page                                      |
| ---------- | ------------------------------------------------- | --------------------------------------------------------- |
| Student    | Own enrollment progress, status, and enrolled date when a row exists | Open course, only when that enrollment exists. It goes to `/student/my-courses/$courseId`. |
| Instructor | Lessons, ordered the same way as the lessons screen | Lessons and Assignments links for that course.           |
| Admin      | Instructor name, and the same lesson list         | None. Approve and Archive stay on their lists.           |

A student does not request `profiles` and does not see lessons. An empty lesson list, for an instructor or admin, says “This course has no lessons yet.” Hiding the section is not the same as an empty list.

## Listings that open this page

The summary of the course is the link. Enroll, Open course, Approve, Archive, Save course, Submit for approval, Lessons, and Assignments stay outside that link.

| Listing                         | `from`        |
| ------------------------------- | ------------- |
| Browse Courses                  | `browse`      |
| My Courses                      | `my-courses`  |
| Learning Assistant course title | `assistant`   |
| Instructor Dashboard courses    | `dashboard`   |
| Instructor My Courses           | `courses`     |
| AI Course Builder saved course  | `builder`     |
| Admin Dashboard courses and enrollments | `dashboard` |
| Approve Courses                 | `approvals`   |
| Archive Courses                 | `archive`     |
| All Enrollments                 | `enrollments` |
| Reports course row              | `reports`     |

A draft course card is a form. Only the saved title and its meta open details. The inputs and save controls stay in the form. The unsaved AI Course Builder preview is not a course yet and does not open details.

Reports uses the course cell and the row. A control inside the row does not also navigate. Submissions, assignments, grades, users, and categories are not course listings and do not open this page.

## Out of scope

- Changing who can read a course, a lesson, or a profile.
- Moving Enroll, Approve, or Archive onto this page.
- A second details implementation per role.
