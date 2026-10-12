import { describe, expect, it } from "vitest";

import {
  compareLessons,
  lessonDraft,
  lessonFieldUpdate,
  lessonInsert,
  nextLessonOrder,
} from "./lesson-draft";

const lesson = {
  title: "Welcome",
  content: "Start here.",
  videoUrl: null,
};

describe("lessonDraft", () => {
  it("requires a trimmed title and content and stores a blank video as null", () => {
    expect(lessonDraft("  Welcome  ", "  Start here.  ", "   ")).toEqual({
      ok: true,
      lesson,
    });
    expect(lessonDraft("Welcome", "Start here.", "  https://video.example/1  ")).toEqual({
      ok: true,
      lesson: { ...lesson, videoUrl: "https://video.example/1" },
    });
  });

  it("rejects a blank title or content before any save", () => {
    expect(lessonDraft("  ", "Start here.", "")).toEqual({
      ok: false,
      message: "Enter a lesson title.",
    });
    expect(lessonDraft("Welcome", "  ", "")).toEqual({
      ok: false,
      message: "Enter lesson content.",
    });
    expect(lessonDraft("  ", "  ", "")).toEqual({
      ok: false,
      message: "Enter a lesson title. Enter lesson content.",
    });
  });
});

describe("lessonInsert", () => {
  it("sets the course, text, and order without generated columns", () => {
    expect(lessonInsert("course-1", lesson, 2)).toEqual({
      course_id: "course-1",
      title: "Welcome",
      content: "Start here.",
      video_url: null,
      order_index: 2,
    });
  });
});

describe("lessonFieldUpdate", () => {
  it("does not send order, course, or generated columns", () => {
    expect(lessonFieldUpdate({ ...lesson, videoUrl: "https://video.example/1" })).toEqual({
      title: "Welcome",
      content: "Start here.",
      video_url: "https://video.example/1",
    });
    expect(Object.keys(lessonFieldUpdate(lesson))).toEqual(["title", "content", "video_url"]);
  });
});

describe("nextLessonOrder", () => {
  it("uses one more than the highest order, or 1 when none is set", () => {
    expect(nextLessonOrder([])).toBe(1);
    expect(nextLessonOrder([null, null])).toBe(1);
    expect(nextLessonOrder([1, null, 3])).toBe(4);
  });
});

describe("compareLessons", () => {
  it("orders numbered lessons first, then by created time", () => {
    const first = { orderIndex: 1, createdAt: "2026-10-02T00:00:00.000Z", id: "first" };
    const second = { orderIndex: 2, createdAt: "2026-10-01T00:00:00.000Z", id: "second" };
    const unnumbered = { orderIndex: null, createdAt: "2026-10-01T00:00:00.000Z", id: "none" };
    const laterUnnumbered = {
      orderIndex: null,
      createdAt: "2026-10-03T00:00:00.000Z",
      id: "later",
    };

    expect(
      [unnumbered, second, laterUnnumbered, first].sort(compareLessons).map((item) => item.id),
    ).toEqual(["first", "second", "none", "later"]);
  });
});
