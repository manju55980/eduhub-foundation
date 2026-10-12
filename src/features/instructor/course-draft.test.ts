import { describe, expect, it } from "vitest";

import { courseDraft, draftCourseInsert } from "./course-draft";

describe("courseDraft", () => {
  it("stores trimmed title and description with a valid level", () => {
    expect(courseDraft("  Intro to Algebra  ", "  Core skills.  ", "beginner")).toEqual({
      ok: true,
      title: "Intro to Algebra",
      description: "Core skills.",
      level: "beginner",
    });
  });

  it("rejects a blank title or description before any insert", () => {
    expect(courseDraft("   ", "A real description", "intermediate")).toEqual({
      ok: false,
      message: "Enter a course title.",
    });
    expect(courseDraft("A real title", "  ", "advanced")).toEqual({
      ok: false,
      message: "Enter a course description.",
    });
  });

  it("rejects a missing level", () => {
    expect(courseDraft("Title", "Description", "")).toEqual({
      ok: false,
      message: "Choose a level.",
    });
  });
});

describe("draftCourseInsert", () => {
  it("sets the owner and draft status and omits generated columns", () => {
    expect(
      draftCourseInsert({
        instructorId: "instructor-1",
        title: "Intro to Algebra",
        description: "Core skills.",
        level: "beginner",
        categoryId: "category-1",
      }),
    ).toEqual({
      instructor_id: "instructor-1",
      title: "Intro to Algebra",
      description: "Core skills.",
      level: "beginner",
      category_id: "category-1",
      status: "draft",
    });
    expect(
      Object.keys(
        draftCourseInsert({
          instructorId: "instructor-1",
          title: "Intro to Algebra",
          description: "Core skills.",
          level: "beginner",
          categoryId: null,
        }),
      ),
    ).toEqual(["instructor_id", "title", "description", "level", "category_id", "status"]);
  });
});
