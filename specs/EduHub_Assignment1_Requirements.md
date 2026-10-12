# SJ Innovation Assignment 1 (Week 1): EduHub LMS

## Mission

Build **EduHub**, a learning management system where instructors create
courses, students enroll and learn, and admins moderate the course
catalogue. The intended scope is a small platform similar to Udemy or
Coursera.

> Project workflow update: this repository is now being developed in
> Cursor. The requirements below remain the assignment source of truth;
> the original tool suggestions do not require continued use of Lovable.

## User roles and permissions

### Student

-   Browse published courses and enroll.
-   View lessons for enrolled courses.
-   Submit assignments.
-   View their own enrollments, grades, and feedback.
-   Must not access another student's private records or grades.

### Instructor

-   Create and manage their own courses and lessons.
-   Review and grade submissions for their own courses.

### Admin

-   Review and publish courses.
-   Manage users and categories.
-   View all enrollments and oversee the platform.

## Role-based navigation

### Student sidebar

-   Browse Courses
-   My Courses
-   Assignments
-   My Grades
-   My Profile

### Instructor sidebar

-   Instructor Dashboard
-   Create Course
-   My Courses (including lessons)
-   Submissions (grading)
-   Profile

### Admin sidebar

-   Admin Dashboard
-   Approve Courses
-   Manage Users
-   Manage Categories
-   All Enrollments
-   Reports

## Core workflow

1.  An instructor signs up and creates a course. It starts as Draft or
    Pending and is not publicly available.
2.  An admin reviews the course and publishes it.
3.  A student browses published courses and enrolls.
4.  The student views lessons and submits an assignment. The submission
    status becomes Submitted.
5.  The instructor grades the submission and adds feedback.
6.  The student can view their grade and feedback.
7.  The admin can oversee platform activity.

## Database requirements

Use plural, lowercase `snake_case` table names; use `snake_case` column
names. Every table should have an `id` and `created_at` field.
Foreign-key columns should end in `_id`.

### `profiles`

-   `id`: UUID corresponding to the authenticated user
-   `full_name`
-   `email`
-   `role`: `student`, `instructor`, or `admin`
-   `phone`
-   `created_at`

### `courses`

-   `id`
-   `instructor_id`: foreign key to `profiles`
-   `title`
-   `description`
-   `level`: `beginner`, `intermediate`, or `advanced`
-   `status`: `draft`, `pending`, `published`, or `archived`
-   `created_at`

### `lessons`

-   `id`
-   `course_id`: foreign key to `courses`
-   `title`
-   `content`
-   `video_url`
-   `order_index`
-   `created_at`

### `enrollments`

-   `id`
-   `student_id`: foreign key to `profiles`
-   `course_id`: foreign key to `courses`
-   `progress`: integer
-   `status`: `active` or `completed`
-   `created_at`

### `assignments`

-   `id`
-   `course_id`: foreign key to `courses`
-   `title`
-   `description`
-   `due_date`
-   `created_at`

### `submissions`

-   `id`
-   `assignment_id`: foreign key to `assignments`
-   `student_id`: foreign key to `profiles`
-   `content_url`
-   `grade`
-   `feedback`
-   `status`: `submitted` or `graded`
-   `created_at`

## Authentication and access control

-   Support email/password authentication.
-   Support Google sign-in.
-   Login is required to access dashboards.
-   New users default to the `student` role.
-   Instructor access can be provided by an instructor choice or an
    admin upgrade. **Project decision:** for simpler, safer signup, all
    new users will start as students; an admin can promote a user to
    instructor.
-   The first admin must be configured manually.
-   Store the role in `profiles` as required by the assignment.
-   Configure Supabase RLS so users cannot read other users' private
    rows, including other students' grades.
-   Do not trust client-side role checks alone to enforce permissions.

## Suggested week plan

### Day 1 --- Setup and authentication

-   Set up the required accounts and connect the app, Supabase, and
    GitHub.
-   Implement email/password and Google authentication.
-   Set up `profiles`.

### Day 2 --- Roles and navigation

-   Implement role-aware routing and the three role-specific sidebars.

### Day 3 --- Core data and screens

-   Create the core tables.
-   Build course creation and listing screens.

### Day 4 --- Main learning workflow

-   Implement enrollment, lesson viewing, and assignment submission.

### Day 5 --- Review and grading

-   Implement course approval, grading, and the relevant statuses.

### Day 6 --- Security and polish

-   Configure and test RLS.
-   Polish navigation and core screens.

### Day 7 --- Deployment and validation

-   Deploy to Vercel.
-   Test all three roles against the live deployment.
-   Prepare the submission report.

## Deployment requirements

-   Deploy the GitHub repository to Vercel.
-   Configure the Supabase URL and publishable/anonymous key as
    environment variables appropriate to the project's actual
    client/server setup.
-   Configure Supabase Auth redirect URLs for Google sign-in.
-   Test authentication on the deployed URL.

## Optional bonus work

Only after all core requirements work: - Animated course progress
tracker (+5) - Optional AI agent (+5)

## Evaluation checklist: core requirements

-   [ ] Email/password authentication works.
-   [ ] Google sign-in works.
-   [ ] Three roles have the correct sidebars.
-   [ ] Instructor-created courses remain hidden until an admin
    publishes them.
-   [ ] Students can enroll and submit assignments.
-   [ ] The correct instructor can grade submissions.
-   [ ] Students cannot view other students' grades; enforce this with
    RLS.
-   [ ] Tables, columns, and foreign keys follow the required naming
    conventions.

## Deliverables

-   Live Vercel URL
-   GitHub repository
-   Lovable project (listed in the original brief; development has since
    moved to Cursor)
-   Supabase project
-   Working login/test credentials for all three roles

## Source and interpretation notes

This Markdown file transcribes the requirements and plan from the
assignment PDF, with one clearly marked project decision: new accounts
will always start as students, and admins can promote users to
instructors. Where the brief allows alternatives, this document records
that decision rather than leaving it ambiguous.

The assignment does not fully specify implementation details such as
exact approval-state transitions, grade format, or the precise schema
for any additional role-management mechanism. Do not invent these
details; document them as open questions if they become necessary.
