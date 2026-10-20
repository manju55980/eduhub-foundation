import { describe, expect, it } from "vitest";

import { progressiveDueDates } from "./assignment-due-dates";

const now = new Date("2026-10-20T12:00:00.000Z");

describe("progressiveDueDates", () => {
  it("spaces assignments across the lesson order", () => {
    expect(progressiveDueDates(6, 4, now)).toEqual([
      "2026-11-03T12:00:00.000Z",
      "2026-11-10T12:00:00.000Z",
      "2026-11-24T12:00:00.000Z",
      "2026-12-01T12:00:00.000Z",
    ]);
  });

  it("still moves each assignment later when there is only one lesson", () => {
    expect(progressiveDueDates(1, 2, now)).toEqual([
      "2026-10-27T12:00:00.000Z",
      "2026-11-03T12:00:00.000Z",
    ]);
  });

  it("returns nothing when there are no assignments", () => {
    expect(progressiveDueDates(3, 0, now)).toEqual([]);
  });
});
