export const appRoles = ["student", "instructor", "admin"] as const;

export type AppRole = (typeof appRoles)[number];

export const roleHome = {
  student: "/student/courses",
  instructor: "/instructor",
  admin: "/admin",
} as const;

export const roleNavigation = {
  student: [
    { label: "Browse Courses", to: "/student/courses" },
    { label: "My Courses", to: "/student/my-courses" },
    { label: "Learning Assistant", to: "/student/assistant" },
    { label: "Assignments", to: "/student/assignments" },
    { label: "My Grades", to: "/student/grades" },
    { label: "My Certificates", to: "/student/certificates" },
  ],
  instructor: [
    { label: "Instructor Dashboard", to: "/instructor" },
    { label: "Create Course", to: "/instructor/courses/new" },
    { label: "AI Course Builder", to: "/instructor/courses/generate" },
    { label: "My Courses (including lessons)", to: "/instructor/courses" },
    { label: "Submissions (grading)", to: "/instructor/submissions" },
  ],
  admin: [
    { label: "Admin Dashboard", to: "/admin" },
    { label: "Manage Courses", to: "/admin/courses" },
    { label: "Manage Users", to: "/admin/users" },
    { label: "Manage Categories", to: "/admin/categories" },
    { label: "All Enrollments", to: "/admin/enrollments" },
    { label: "Reports", to: "/admin/reports" },
  ],
} as const;

export function isAppRole(value: string): value is AppRole {
  return value === "student" || value === "instructor" || value === "admin";
}
