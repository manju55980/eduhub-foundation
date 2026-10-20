import { describe, expect, it } from "vitest";

import { gradeDraft, gradeUpdate } from "./grade-draft";
import { gradableSubmissions, submissionViews, type SubmissionSource } from "./submissions";

const older: SubmissionSource = {
  id: "submission-old",
  assignmentId: "assignment-1",
  studentId: "student-1",
  contentUrl: "My essay.",
  grade: null,
  feedback: null,
  status: "submitted",
  createdAt: "2026-10-01T00:00:00.000Z",
};

const newer: SubmissionSource = {
  id: "submission-new",
  assignmentId: "assignment-missing",
  studentId: "student-missing",
  contentUrl: null,
  grade: "Pass",
  feedback: "Clear.",
  status: "graded",
  createdAt: "2026-10-10T00:00:00.000Z",
};

describe("gradeDraft", () => {
  it("requires a whole number from 1 to 10 and stores a blank feedback as null", () => {
    expect(gradeDraft("  8  ", "   ")).toEqual({
      ok: true,
      grade: { grade: "8", feedback: null },
    });
    expect(gradeDraft("10", "  Clear argument.  ")).toEqual({
      ok: true,
      grade: { grade: "10", feedback: "Clear argument." },
    });
    expect(gradeDraft("1", "")).toEqual({
      ok: true,
      grade: { grade: "1", feedback: null },
    });
    expect(gradeDraft("  ", "Clear.")).toEqual({
      ok: false,
      message: "Enter a grade.",
    });
    expect(gradeDraft("11", "Clear.")).toEqual({
      ok: false,
      message: "Enter a grade from 1 to 10.",
    });
    expect(gradeDraft("0", "Clear.")).toEqual({
      ok: false,
      message: "Enter a grade from 1 to 10.",
    });
    expect(gradeDraft("Pass", "Clear.")).toEqual({
      ok: false,
      message: "Enter a grade from 1 to 10.",
    });
  });
});

describe("gradeUpdate", () => {
  it("sends only the grade, feedback, and graded status", () => {
    expect(gradeUpdate({ grade: "Pass", feedback: null })).toEqual({
      grade: "Pass",
      feedback: null,
      status: "graded",
    });
    expect(Object.keys(gradeUpdate({ grade: "Pass", feedback: null }))).toEqual([
      "grade",
      "feedback",
      "status",
    ]);
  });
});

describe("gradableSubmissions", () => {
  it("lists every submission newest first and leaves a missing name blank", () => {
    const submissions = gradableSubmissions(
      [older, newer],
      [{ id: "assignment-1", courseId: "course-1", title: "Essay" }],
      [{ id: "course-1", title: "Archived course" }],
      [{ id: "student-1", fullName: "Ada Lovelace" }],
    );

    expect(submissions.map((submission) => submission.id)).toEqual([
      "submission-new",
      "submission-old",
    ]);
    expect(submissions[0]).toMatchObject({
      assignmentTitle: null,
      courseTitle: null,
      studentName: null,
      contentUrl: null,
      grade: "Pass",
      status: "graded",
    });
    expect(submissions[1]).toMatchObject({
      assignmentTitle: "Essay",
      courseTitle: "Archived course",
      studentName: "Ada Lovelace",
      contentUrl: "My essay.",
      grade: null,
    });
  });
});

describe("submissionViews", () => {
  it("keeps submitted rows in To Grade and graded rows in Graded", () => {
    const views = submissionViews([
      {
        id: "submission-new",
        contentUrl: null,
        grade: "Pass",
        feedback: "Clear.",
        status: "graded",
        createdAt: "2026-10-10T00:00:00.000Z",
        assignmentTitle: null,
        courseTitle: null,
        studentName: null,
      },
      {
        id: "submission-old",
        contentUrl: "My essay.",
        grade: null,
        feedback: null,
        status: "submitted",
        createdAt: "2026-10-01T00:00:00.000Z",
        assignmentTitle: "Essay",
        courseTitle: "Archived course",
        studentName: "Ada Lovelace",
      },
    ]);

    expect(views.toGrade.map((submission) => submission.id)).toEqual(["submission-old"]);
    expect(views.graded.map((submission) => submission.id)).toEqual(["submission-new"]);
  });
});
