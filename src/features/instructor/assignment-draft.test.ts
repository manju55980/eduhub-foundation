import { describe, expect, it } from "vitest";

import { assignmentDraft, assignmentFieldUpdate, assignmentInsert } from "./assignment-draft";

const assignment = {
  title: "Essay",
  description: "Write two pages.",
  dueDate: null,
};

describe("assignmentDraft", () => {
  it("requires a trimmed title and description and stores a blank due date as null", () => {
    expect(assignmentDraft("  Essay  ", "  Write two pages.  ", "   ")).toEqual({
      ok: true,
      assignment,
    });
  });

  it("stores a due date without requiring it to be in the future", () => {
    const result = assignmentDraft("Essay", "Write two pages.", "2020-01-02T03:04");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assignment.title).toBe("Essay");
    expect(result.assignment.description).toBe("Write two pages.");
    expect(result.assignment.dueDate).toBe(new Date("2020-01-02T03:04").toISOString());
  });

  it("rejects a blank title, description, or invalid due date before any save", () => {
    expect(assignmentDraft("  ", "Write two pages.", "")).toEqual({
      ok: false,
      message: "Enter an assignment title.",
    });
    expect(assignmentDraft("Essay", "  ", "")).toEqual({
      ok: false,
      message: "Enter an assignment description.",
    });
    expect(assignmentDraft("  ", "  ", "not-a-date")).toEqual({
      ok: false,
      message:
        "Enter an assignment title. Enter an assignment description. Enter a valid due date.",
    });
  });
});

describe("assignmentInsert", () => {
  it("sets the course and text without generated columns", () => {
    expect(assignmentInsert("course-1", assignment)).toEqual({
      course_id: "course-1",
      title: "Essay",
      description: "Write two pages.",
      due_date: null,
    });
    expect(Object.keys(assignmentInsert("course-1", assignment))).toEqual([
      "course_id",
      "title",
      "description",
      "due_date",
    ]);
  });
});

describe("assignmentFieldUpdate", () => {
  it("does not send the course or generated columns", () => {
    expect(assignmentFieldUpdate({ ...assignment, dueDate: "2026-10-10T00:00:00.000Z" })).toEqual({
      title: "Essay",
      description: "Write two pages.",
      due_date: "2026-10-10T00:00:00.000Z",
    });
    expect(Object.keys(assignmentFieldUpdate(assignment))).toEqual([
      "title",
      "description",
      "due_date",
    ]);
  });
});
