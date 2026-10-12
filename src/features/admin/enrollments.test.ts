import { describe, expect, it } from "vitest";

import { adminEnrollments, type AdminEnrollmentSource } from "./enrollments";

const older: AdminEnrollmentSource = {
  id: "enrollment-old",
  studentId: "student-1",
  courseId: "course-1",
  progress: 40,
  status: "active",
  enrolledAt: "2026-10-01T00:00:00.000Z",
};

const newer: AdminEnrollmentSource = {
  id: "enrollment-new",
  studentId: "student-missing",
  courseId: "course-missing",
  progress: 0,
  status: "active",
  enrolledAt: "2026-10-11T00:00:00.000Z",
};

const blankTitle: AdminEnrollmentSource = {
  id: "enrollment-blank",
  studentId: "student-missing",
  courseId: "course-blank",
  progress: 100,
  status: "completed",
  enrolledAt: "2026-10-10T00:00:00.000Z",
};

describe("adminEnrollments", () => {
  it("lists enrollments newest first and omits a missing course", () => {
    const enrollments = adminEnrollments(
      [older, newer, blankTitle],
      [
        { id: "course-1", title: "Archived course", status: "archived" },
        { id: "course-blank", title: null, status: "published" },
      ],
      [{ id: "student-1", fullName: "Ada Lovelace" }],
    );

    expect(enrollments.map((enrollment) => enrollment.id)).toEqual([
      "enrollment-blank",
      "enrollment-old",
    ]);
    expect(enrollments[0]).toEqual({
      id: "enrollment-blank",
      studentName: null,
      title: null,
      courseStatus: "published",
      progress: 100,
      enrollmentStatus: "completed",
      enrolledAt: "2026-10-10T00:00:00.000Z",
    });
    expect(enrollments[1]).toEqual({
      id: "enrollment-old",
      studentName: "Ada Lovelace",
      title: "Archived course",
      courseStatus: "archived",
      progress: 40,
      enrollmentStatus: "active",
      enrolledAt: "2026-10-01T00:00:00.000Z",
    });
  });
});
