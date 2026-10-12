import { describe, expect, it } from "vitest";

import {
  canSubmitCourse,
  compareCoursesNewestFirst,
  courseFieldPayload,
  courseFieldUpdate,
  pendingStatusUpdate,
} from "./course-update";

describe("courseFieldUpdate", () => {
  it("sends the trimmed title, description, level, and an optional category", () => {
    const result = courseFieldUpdate("  Algebra  ", "  Core skills.  ", "beginner", " category-1 ");

    expect(result).toEqual({
      ok: true,
      changes: {
        title: "Algebra",
        description: "Core skills.",
        level: "beginner",
        categoryId: "category-1",
      },
    });
    expect(result.ok && Object.keys(result.changes)).toEqual([
      "title",
      "description",
      "level",
      "categoryId",
    ]);
    expect(courseFieldUpdate("Algebra", "Core skills.", "beginner", "   ")).toEqual({
      ok: true,
      changes: {
        title: "Algebra",
        description: "Core skills.",
        level: "beginner",
        categoryId: null,
      },
    });
  });

  it("rejects a blank title, description, or level before any update", () => {
    expect(courseFieldUpdate("  ", "Core skills.", "beginner", "")).toEqual({
      ok: false,
      message: "Enter a course title.",
    });
    expect(courseFieldUpdate("Algebra", "  ", "advanced", "")).toEqual({
      ok: false,
      message: "Enter a course description.",
    });
    expect(courseFieldUpdate("Algebra", "Core skills.", "", "category-1")).toEqual({
      ok: false,
      message: "Choose a level.",
    });
  });
});

describe("courseFieldPayload", () => {
  it("updates the category and does not send status", () => {
    const payload = courseFieldPayload({
      title: "Algebra",
      description: "Core skills.",
      level: "beginner",
      categoryId: null,
    });

    expect(payload).toEqual({
      title: "Algebra",
      description: "Core skills.",
      level: "beginner",
      category_id: null,
    });
    expect(Object.keys(payload)).toEqual(["title", "description", "level", "category_id"]);
  });
});

describe("canSubmitCourse", () => {
  it("allows submit only for a draft that already has a lesson", () => {
    expect(canSubmitCourse("draft", 1)).toBe(true);
    expect(canSubmitCourse("draft", 0)).toBe(false);
    expect(canSubmitCourse("pending", 2)).toBe(false);
    expect(canSubmitCourse("published", 2)).toBe(false);
    expect(canSubmitCourse("archived", 2)).toBe(false);
  });
});

describe("pendingStatusUpdate", () => {
  it("changes only status to pending", () => {
    expect(pendingStatusUpdate()).toEqual({ status: "pending" });
    expect(Object.keys(pendingStatusUpdate())).toEqual(["status"]);
  });
});

describe("compareCoursesNewestFirst", () => {
  it("orders newer created times first", () => {
    const older = { createdAt: "2026-10-01T00:00:00.000Z" };
    const newer = { createdAt: "2026-10-02T00:00:00.000Z" };

    expect([older, newer].sort(compareCoursesNewestFirst)).toEqual([newer, older]);
  });
});
