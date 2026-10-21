import { describe, expect, it, vi } from "vitest";

import { parseBuilderRequest } from "../../../supabase/functions/_shared/course-preview.ts";
import {
  learningVideoQuery,
  missingVideoMessage,
  searchLearningVideos,
} from "../../../supabase/functions/_shared/learning-videos.ts";

describe("course builder request", () => {
  it("requires lesson and assignment counts and keeps optional guidance", () => {
    expect(parseBuilderRequest({ brief: "Plants", level: "beginner" })).toEqual({
      ok: false,
      message: "Enter the number of lessons.",
    });
    expect(
      parseBuilderRequest({
        brief: "Plants",
        level: "beginner",
        lessonCount: 7,
        assignmentCount: 1,
      }),
    ).toEqual({ ok: false, message: "Choose 1 to 6 lessons." });

    const parsed = parseBuilderRequest({
      brief: " Plants ",
      level: "intermediate",
      lessonCount: "3",
      assignmentCount: "0",
      difficulty: " slower pace ",
      goals: "Name the parts of a plant.",
      projects: "Grow a bean.",
      resources: "short clips",
    });
    expect(parsed).toMatchObject({
      ok: true,
      brief: "Plants",
      level: "intermediate",
      lessonCount: 3,
      assignmentCount: 0,
      difficulty: "slower pace",
      goals: "Name the parts of a plant.",
      projects: "Grow a bean.",
      resources: "short clips",
    });
  });
});

describe("search_learning_videos", () => {
  it("builds one short query and does not call YouTube without a key", async () => {
    expect(learningVideoQuery("  Plant cells  ", "  short clips  ")).toBe(
      "Plant cells short clips",
    );
    const fetchImpl = vi.fn<typeof fetch>();
    const missing = await searchLearningVideos(
      { apiKey: "  ", query: "Plant cells", limit: 3 },
      fetchImpl,
    );
    expect(missing).toEqual({ ok: false, message: missingVideoMessage });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a safe message when the search request fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("network down AIzaSyShouldNotLeak1234567890");
    });
    const failed = await searchLearningVideos(
      { apiKey: "AIzaSyShouldNotLeak1234567890", query: "Plant cells", limit: 8 },
      fetchImpl,
    );
    expect(failed).toEqual({
      ok: false,
      message: "Video suggestions are unavailable right now.",
    });
    expect(JSON.stringify(failed)).not.toContain("AIzaSyShouldNotLeak1234567890");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
