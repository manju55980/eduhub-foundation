import { describe, expect, it } from "vitest";

import { enrollmentInsert } from "./enrollment";

describe("enrollmentInsert", () => {
  it("enrolls the signed-in student at progress 0 and status active", () => {
    const row = enrollmentInsert("student-1", "course-1");

    expect(row).toEqual({
      student_id: "student-1",
      course_id: "course-1",
      progress: 0,
      status: "active",
    });
    expect(Object.keys(row)).toEqual(["student_id", "course_id", "progress", "status"]);
  });
});
