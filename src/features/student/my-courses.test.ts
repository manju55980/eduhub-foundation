import { describe, expect, it } from "vitest";

import { enrolledCourses, type EnrolledCourseSource, type EnrollmentRow } from "./my-courses";

const archived: EnrolledCourseSource = {
  id: "course-archived",
  title: "Archived course",
  description: "Still available",
  level: "advanced",
  status: "archived",
  createdAt: "2026-09-01T00:00:00.000Z",
};

const published: EnrolledCourseSource = {
  id: "course-published",
  title: "Published course",
  description: "Open",
  level: "beginner",
  status: "published",
  createdAt: "2026-10-09T00:00:00.000Z",
};

const older: EnrollmentRow = {
  enrollmentId: "enrollment-older",
  courseId: "course-archived",
  progress: 40,
  status: "active",
  enrolledAt: "2026-10-01T00:00:00.000Z",
};

const newer: EnrollmentRow = {
  enrollmentId: "enrollment-newer",
  courseId: "course-published",
  progress: 100,
  status: "completed",
  enrolledAt: "2026-10-10T00:00:00.000Z",
};

describe("enrolledCourses", () => {
  it("lists enrolled courses newest enrollment first, including archived", () => {
    const courses = enrolledCourses([older, newer], [archived, published]);

    expect(courses.map((course) => course.id)).toEqual(["course-published", "course-archived"]);
    expect(courses[0]).toMatchObject({
      title: "Published course",
      status: "published",
      progress: 100,
      enrollmentStatus: "completed",
      enrolledAt: "2026-10-10T00:00:00.000Z",
    });
    expect(courses[1]).toMatchObject({
      status: "archived",
      progress: 40,
      enrollmentStatus: "active",
    });
  });

  it("omits an enrollment whose course was not returned and ignores a course with no enrollment", () => {
    const unenrolled: EnrolledCourseSource = {
      id: "course-other",
      title: "Not joined",
      description: null,
      level: "intermediate",
      status: "published",
      createdAt: "2026-10-11T00:00:00.000Z",
    };

    const courses = enrolledCourses(
      [older, { ...newer, courseId: "course-missing" }],
      [archived, unenrolled],
    );

    expect(courses.map((course) => course.id)).toEqual(["course-archived"]);
  });
});
