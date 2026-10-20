import { describe, expect, it } from "vitest";

import {
  adminDetailReturn,
  instructorDetailReturn,
  statusShownToStudent,
  studentDetailReturn,
  toCourseDetail,
} from "./course-details";

const course = {
  id: "course-1",
  title: "Algebra",
  description: null,
  level: "beginner",
  status: "published",
  categoryName: "",
  createdAt: "2026-10-09T00:00:00.000Z",
};

describe("statusShownToStudent", () => {
  it("shows completed instead of published only for that student's finished course", () => {
    expect(statusShownToStudent("published", "completed")).toBe("completed");
    expect(statusShownToStudent("published", "active")).toBe("published");
    expect(statusShownToStudent("published", null)).toBe("published");
    expect(statusShownToStudent("archived", "completed")).toBe("archived");
  });
});

describe("toCourseDetail", () => {
  it("hides lessons and leaves enrollment empty until they are provided", () => {
    expect(toCourseDetail(course)).toMatchObject({
      lessons: null,
      enrollment: null,
      instructorName: null,
    });
  });

  it("keeps an empty lesson list distinct from a hidden lesson list", () => {
    expect(
      toCourseDetail({
        ...course,
        lessons: [],
        enrollment: {
          progress: 40,
          status: "active",
          enrolledAt: "2026-10-10T00:00:00.000Z",
        },
      }).lessons,
    ).toEqual([]);
  });
});

describe("course detail return paths", () => {
  it("sends each listing back to the page that opened the course", () => {
    expect(studentDetailReturn("browse")).toEqual({
      to: "/student/courses",
      label: "Browse Courses",
    });
    expect(studentDetailReturn("my-courses").label).toBe("My Courses");
    expect(studentDetailReturn("assistant").to).toBe("/student/assistant");
    expect(instructorDetailReturn("dashboard").to).toBe("/instructor");
    expect(instructorDetailReturn("builder").label).toBe("AI Course Builder");
    expect(instructorDetailReturn("courses").to).toBe("/instructor/courses");
    expect(adminDetailReturn("archive").label).toBe("Archive Courses");
    expect(adminDetailReturn("dashboard").to).toBe("/admin");
    expect(adminDetailReturn("enrollments").label).toBe("All Enrollments");
    expect(adminDetailReturn("reports").label).toBe("Reports");
    expect(adminDetailReturn("approvals").to).toBe("/admin/courses/approvals");
  });
});
