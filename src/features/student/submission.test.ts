import { describe, expect, it } from "vitest";

import {
  studentAssignments,
  submissionDraft,
  submissionInsert,
  type AssignmentSource,
  type CourseTitle,
} from "./submission";

const older: AssignmentSource = {
  id: "assignment-old",
  courseId: "course-archived",
  title: "Essay",
  description: "Write two pages.",
  dueDate: "2020-01-01T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
};

const newer: AssignmentSource = {
  id: "assignment-new",
  courseId: "course-published",
  title: "Quiz",
  description: null,
  dueDate: null,
  createdAt: "2026-10-10T00:00:00.000Z",
};

const courses: CourseTitle[] = [
  { id: "course-archived", title: "Archived course" },
  { id: "course-published", title: null },
];

describe("submissionDraft", () => {
  it("trims text or a link and rejects a blank value", () => {
    expect(submissionDraft("  https://notes.example/1  ")).toEqual({
      ok: true,
      contentUrl: "https://notes.example/1",
    });
    expect(submissionDraft("  My essay.  ")).toEqual({
      ok: true,
      contentUrl: "My essay.",
    });
    expect(submissionDraft("   ")).toEqual({
      ok: false,
      message: "Enter your submission.",
    });
  });
});

describe("submissionInsert", () => {
  it("sends one submitted row without generated columns or a grade", () => {
    expect(submissionInsert("student-1", "assignment-1", "My essay.")).toEqual({
      assignment_id: "assignment-1",
      student_id: "student-1",
      content_url: "My essay.",
      status: "submitted",
      grade: null,
      feedback: null,
    });
    expect(Object.keys(submissionInsert("student-1", "assignment-1", "My essay."))).toEqual([
      "assignment_id",
      "student_id",
      "content_url",
      "status",
      "grade",
      "feedback",
    ]);
  });
});

describe("studentAssignments", () => {
  it("lists enrolled-course assignments newest first and keeps an existing submission", () => {
    const assignments = studentAssignments([older, newer], courses, [
      {
        assignmentId: "assignment-old",
        contentUrl: "Done",
        status: "graded",
      },
    ]);

    expect(assignments.map((assignment) => assignment.id)).toEqual([
      "assignment-new",
      "assignment-old",
    ]);
    expect(assignments[0]).toMatchObject({
      courseTitle: null,
      dueDate: null,
      submission: null,
    });
    expect(assignments[1]).toMatchObject({
      courseTitle: "Archived course",
      dueDate: "2020-01-01T00:00:00.000Z",
      submission: { contentUrl: "Done", status: "graded" },
    });
  });

  it("omits an assignment whose course was not returned", () => {
    const assignments = studentAssignments(
      [older, { ...newer, courseId: "course-missing" }],
      [{ id: "course-archived", title: "Archived course" }],
      [],
    );

    expect(assignments.map((assignment) => assignment.id)).toEqual(["assignment-old"]);
  });
});
