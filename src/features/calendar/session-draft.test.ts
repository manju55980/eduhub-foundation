import { describe, expect, it } from "vitest";

import {
  classSessionDraft,
  classSessionInsert,
  classSessionUpdate,
  meetingWindow,
} from "./session-draft";

describe("classSessionDraft", () => {
  it("trims the title, drops a blank location, and keeps the end after the start", () => {
    const result = classSessionDraft({
      courseId: " course-1 ",
      title: "  Seminar  ",
      startsAt: "2026-11-11T09:30",
      endsAt: "2026-11-11T10:30",
      location: "   ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session).toEqual({
      courseId: "course-1",
      title: "Seminar",
      startsAt: new Date("2026-11-11T09:30").toISOString(),
      endsAt: new Date("2026-11-11T10:30").toISOString(),
      location: null,
    });
    expect(classSessionInsert(result.session)).toEqual({
      course_id: "course-1",
      title: "Seminar",
      starts_at: result.session.startsAt,
      ends_at: result.session.endsAt,
      location: null,
    });
    expect(classSessionUpdate(result.session)).toEqual({
      title: "Seminar",
      starts_at: result.session.startsAt,
      ends_at: result.session.endsAt,
      location: null,
    });
    expect(classSessionUpdate(result.session)).not.toHaveProperty("course_id");
  });

  it("rejects a missing course, a blank title, and an end time that is not later", () => {
    expect(
      classSessionDraft({
        courseId: " ",
        title: " ",
        startsAt: "",
        endsAt: "",
        location: "",
      }),
    ).toEqual({
      ok: false,
      message: "Choose a course. Enter a class title. Enter a start time. Enter an end time.",
    });
    expect(
      classSessionDraft({
        courseId: "course-1",
        title: "Seminar",
        startsAt: "2026-11-11T10:30",
        endsAt: "2026-11-11T09:30",
        location: "Room 2",
      }),
    ).toEqual({ ok: false, message: "End time must be after the start time." });
    expect(
      classSessionDraft({
        courseId: "course-1",
        title: "Seminar",
        startsAt: "2026-11-11T09:30",
        endsAt: "2026-11-11T09:30",
        location: "",
      }),
    ).toEqual({ ok: false, message: "End time must be after the start time." });
  });
});

describe("meetingWindow", () => {
  it("starts a new meeting at 9:00 on the selected day", () => {
    expect(meetingWindow(new Date(2026, 10, 11, 15, 45))).toEqual({
      startsAt: "2026-11-11T09:00",
      endsAt: "2026-11-11T10:00",
    });
  });
});
