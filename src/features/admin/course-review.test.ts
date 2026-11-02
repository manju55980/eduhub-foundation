import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/integrations/supabase/types";

import { listNewestCourseReviews, requestCourseReview } from "./course-review-api";
import {
  courseReviewFromRow,
  formatConfidence,
  newestCourseReviews,
  recommendationLabel,
  type CourseReview,
} from "./course-review";

const { from, invoke } = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    functions: {
      invoke: (...args: unknown[]) => invoke(...args),
    },
  },
}));

type CourseReviewRow = Database["public"]["Tables"]["course_reviews"]["Row"];

function row(overrides: Partial<CourseReviewRow> = {}): CourseReviewRow {
  return {
    id: "review-1",
    course_id: "course-1",
    recommendation: "revise",
    confidence: 0.69,
    summary: "Add practice.",
    findings: ["The last lesson jumps ahead."],
    created_at: "2026-11-02T00:00:00.000Z",
    ...overrides,
  };
}

function review(overrides: Partial<CourseReview> = {}): CourseReview {
  return {
    id: "review-1",
    courseId: "course-1",
    recommendation: "revise",
    confidence: 0.69,
    summary: "Add practice.",
    findings: ["The last lesson jumps ahead."],
    createdAt: "2026-11-02T00:00:00.000Z",
    lowConfidence: true,
    ...overrides,
  };
}

describe("course review records", () => {
  it("labels confidence below 0.70 and keeps 0.70", () => {
    const low = courseReviewFromRow(row());
    const enough = courseReviewFromRow(row({ confidence: 0.7, recommendation: "recommend" }));

    expect(low?.lowConfidence).toBe(true);
    expect(low?.recommendation).toBe("revise");
    expect(recommendationLabel("revise")).toBe("Revise");
    expect(enough?.lowConfidence).toBe(false);
    expect(recommendationLabel("recommend")).toBe("Recommend");
    expect(formatConfidence(0.69)).toBe("0.69");
    expect(courseReviewFromRow(row({ recommendation: "approve" }))).toBeNull();
  });

  it("keeps only the newest review for a course", () => {
    const reviews = newestCourseReviews([
      review({ id: "older", createdAt: "2026-11-01T00:00:00.000Z", summary: "Older" }),
      review({ id: "newer", createdAt: "2026-11-02T00:00:00.000Z", summary: "Newer" }),
      review({
        id: "other",
        courseId: "course-2",
        createdAt: "2026-10-01T00:00:00.000Z",
        summary: "Other",
      }),
    ]);

    expect(reviews.map((item) => item.summary).sort()).toEqual(["Newer", "Other"]);
  });
});

describe("course review api", () => {
  beforeEach(() => {
    from.mockReset();
    invoke.mockReset();
  });

  it("does not query when there are no pending courses", async () => {
    await expect(listNewestCourseReviews([])).resolves.toEqual({ ok: true, reviews: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it("reads review rows and does not update a course", async () => {
    const order = vi.fn(async () => ({
      data: [row(), row({ id: "old", created_at: "2026-10-01" })],
      error: null,
    }));
    const filter = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ in: filter }));
    from.mockReturnValue({ select });

    const result = await listNewestCourseReviews(["course-1"]);

    expect(from).toHaveBeenCalledWith("course_reviews");
    expect(select).toHaveBeenCalledWith(
      "id, course_id, recommendation, confidence, summary, findings, created_at",
    );
    expect(filter).toHaveBeenCalledWith("course_id", ["course-1"]);
    expect(result.ok && result.reviews.map((item) => item.id)).toEqual(["review-1"]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("invokes ai-course-review with the course id and returns the saved review", async () => {
    invoke.mockResolvedValue({
      data: {
        ok: true,
        recommendation: "recommend",
        confidence: 0.91,
        summary: "The lessons progress.",
        findings: ["Keep the practice task."],
      },
      error: null,
    });

    const result = await requestCourseReview("course-1");

    expect(invoke).toHaveBeenCalledWith("ai-course-review", { body: { courseId: "course-1" } });
    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      review: {
        recommendation: "recommend",
        confidence: 0.91,
        lowConfidence: false,
        summary: "The lessons progress.",
        findings: ["Keep the practice task."],
      },
    });
  });

  it("returns the function error and does not treat it as a saved review", async () => {
    invoke.mockResolvedValue({
      data: { ok: false, message: "AI is not configured." },
      error: null,
    });

    await expect(requestCourseReview("course-1")).resolves.toEqual({
      ok: false,
      message: "AI is not configured.",
    });
  });
});
