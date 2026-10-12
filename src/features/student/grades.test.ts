import { describe, expect, it } from "vitest";

import { studentGrades, type GradedSubmissionSource } from "./grades";

const older: GradedSubmissionSource = {
  id: "submission-old",
  assignmentId: "assignment-1",
  contentUrl: "My essay.",
  grade: "Pass",
  feedback: "Clear.",
  status: "graded",
  createdAt: "2026-10-01T00:00:00.000Z",
};

const newer: GradedSubmissionSource = {
  id: "submission-new",
  assignmentId: "assignment-missing",
  contentUrl: "https://example.com/work",
  grade: "18/20",
  feedback: null,
  status: "graded",
  createdAt: "2026-10-10T00:00:00.000Z",
};

const waiting: GradedSubmissionSource = {
  id: "submission-waiting",
  assignmentId: "assignment-1",
  contentUrl: "Not graded yet.",
  grade: null,
  feedback: null,
  status: "submitted",
  createdAt: "2026-10-11T00:00:00.000Z",
};

describe("studentGrades", () => {
  it("lists graded submissions newest first and keeps a missing course", () => {
    const grades = studentGrades(
      [older, newer, waiting],
      [
        {
          id: "assignment-1",
          courseId: "course-1",
          title: "Essay",
          description: "Write one page.",
          dueDate: "2020-01-01T00:00:00.000Z",
        },
      ],
      [{ id: "course-1", title: "Archived course" }],
    );

    expect(grades.map((grade) => grade.id)).toEqual(["submission-new", "submission-old"]);
    expect(grades[0]).toMatchObject({
      assignmentTitle: null,
      description: null,
      dueDate: null,
      courseTitle: null,
      contentUrl: "https://example.com/work",
      grade: "18/20",
      feedback: null,
      status: "graded",
    });
    expect(grades[1]).toMatchObject({
      assignmentTitle: "Essay",
      description: "Write one page.",
      dueDate: "2020-01-01T00:00:00.000Z",
      courseTitle: "Archived course",
      contentUrl: "My essay.",
      grade: "Pass",
      feedback: "Clear.",
    });
  });
});
