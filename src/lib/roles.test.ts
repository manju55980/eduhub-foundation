import { describe, expect, it } from "vitest";

import { roleNavigation } from "./roles";

describe("roleNavigation", () => {
  it("lists only the assignment sidebar items for each role", () => {
    expect(roleNavigation.student.map((item) => item.label)).toEqual([
      "Browse Courses",
      "My Courses",
      "Learning Assistant",
      "Assignments",
      "My Grades",
      "My Certificates",
      "My Profile",
    ]);
    expect(roleNavigation.instructor.map((item) => item.label)).toEqual([
      "Instructor Dashboard",
      "Create Course",
      "AI Course Builder",
      "My Courses (including lessons)",
      "Submissions (grading)",
      "Profile",
    ]);
    expect(roleNavigation.admin.map((item) => item.label)).toEqual([
      "Admin Dashboard",
      "Approve Courses",
      "Manage Users",
      "Manage Categories",
      "All Enrollments",
      "Reports",
    ]);
  });
});
