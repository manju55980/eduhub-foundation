import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { readFunctionResult } from "@/features/ai/function-result";
import { parseReviewReply } from "../../../supabase/functions/_shared/course-review.ts";
import { invalidAiMessage } from "../../../supabase/functions/_shared/gemini.ts";

import { courseReviewFromRow, newestCourseReviews, type CourseReview } from "./course-review";

type CourseReviewRow = Database["public"]["Tables"]["course_reviews"]["Row"];

const reviewColumns =
  "id, course_id, recommendation, confidence, summary, findings, created_at" as const;

export async function listNewestCourseReviews(courseIds: string[]) {
  if (courseIds.length === 0) return { ok: true as const, reviews: [] as CourseReview[] };

  const { data, error } = await supabase
    .from("course_reviews")
    .select(reviewColumns)
    .in("course_id", courseIds)
    .order("created_at", { ascending: false });

  if (error) return { ok: false as const, message: error.message };
  const reviews = (data ?? []).flatMap((row) => {
    const review = courseReviewFromRow(row);
    return review ? [review] : [];
  });
  return { ok: true as const, reviews: newestCourseReviews(reviews) };
}

export async function requestCourseReview(courseId: string) {
  const { data, error } = await supabase.functions.invoke("ai-course-review", {
    body: { courseId },
  });
  const result = await readFunctionResult(data, error);
  if (!result.ok) return result;

  const parsed = parseReviewReply(result.value);
  if (!parsed.ok) return parsed;
  const row: CourseReviewRow = {
    id: "",
    course_id: courseId,
    recommendation: parsed.review.recommendation,
    confidence: parsed.review.confidence,
    summary: parsed.review.summary,
    findings: parsed.review.findings,
    created_at: "",
  };
  const review = courseReviewFromRow(row);
  if (!review) return { ok: false as const, message: invalidAiMessage };
  return { ok: true as const, review };
}
