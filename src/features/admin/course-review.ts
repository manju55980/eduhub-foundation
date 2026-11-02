import type { Database } from "@/integrations/supabase/types";
import { isLowConfidence } from "../../../supabase/functions/_shared/guardrails.ts";

type CourseReviewRow = Database["public"]["Tables"]["course_reviews"]["Row"];

export type CourseReview = {
  id: string;
  courseId: string;
  recommendation: "recommend" | "revise";
  confidence: number;
  summary: string;
  findings: string[];
  createdAt: string;
  lowConfidence: boolean;
};

export function recommendationLabel(recommendation: CourseReview["recommendation"]) {
  return recommendation === "recommend" ? "Recommend" : "Revise";
}

export function formatConfidence(confidence: number) {
  return String(confidence);
}

export function courseReviewFromRow(row: CourseReviewRow): CourseReview | null {
  if (row.recommendation !== "recommend" && row.recommendation !== "revise") return null;
  if (!Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1) return null;
  if (!row.summary.trim()) return null;
  return {
    id: row.id,
    courseId: row.course_id,
    recommendation: row.recommendation,
    confidence: row.confidence,
    summary: row.summary,
    findings: row.findings.filter((finding) => finding.trim().length > 0),
    createdAt: row.created_at,
    lowConfidence: isLowConfidence(row.confidence),
  };
}

export function newestCourseReviews(reviews: CourseReview[]) {
  const byCourse = new Map<string, CourseReview>();
  for (const review of reviews) {
    const current = byCourse.get(review.courseId);
    if (!current || review.createdAt > current.createdAt) byCourse.set(review.courseId, review);
  }
  return [...byCourse.values()];
}

export function reviewForCourse(reviews: CourseReview[], courseId: string) {
  return reviews.find((review) => review.courseId === courseId) ?? null;
}
