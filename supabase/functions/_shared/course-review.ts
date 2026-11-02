import { invalidAiMessage } from "./gemini.ts";
import {
  asRecord,
  enumValue,
  isCourseId,
  readConfidence,
  redactPii,
  requiredText,
  textList,
  untrustedDataRule,
  wrapUntrusted,
} from "./guardrails.ts";

export const adminOnlyMessage = "Only an admin can review a course.";
export const notWaitingMessage = "This course is not waiting for approval.";
export const reviewSaveMessage = "The review could not be saved.";
export const summaryLimit = 2000;
export const findingLimit = 500;
export const findingCount = 8;

const recommendations = ["recommend", "revise"] as const;

export type ReviewRecommendation = (typeof recommendations)[number];

export type ReviewCourse = {
  title: string | null;
  description: string | null;
  level: string;
  status: string;
};

export type ReviewLesson = {
  title: string | null;
  content: string | null;
  orderIndex: number | null;
  createdAt: string;
};

export type ReviewAssignment = {
  title: string | null;
  description: string | null;
  dueDate: string | null;
};

export type ReviewMaterial = {
  fileName: string;
  mimeType: string;
};

export type StoredReview = {
  recommendation: ReviewRecommendation;
  confidence: number;
  lowConfidence: boolean;
  summary: string;
  findings: string[];
};

export function courseIdFromBody(
  body: unknown,
): { ok: true; courseId: string } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body) || !("courseId" in body)) {
    return { ok: false, message: "The request was not valid." };
  }
  const raw = body.courseId;
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, message: "The request was not valid." };
  }
  const courseId = raw.trim();
  if (!isCourseId(courseId)) return { ok: false, message: notWaitingMessage };
  return { ok: true, courseId };
}

export function sortReviewLessons(lessons: ReviewLesson[]) {
  return [...lessons].sort((left, right) => {
    if (left.orderIndex == null && right.orderIndex != null) return 1;
    if (left.orderIndex != null && right.orderIndex == null) return -1;
    if (
      left.orderIndex != null &&
      right.orderIndex != null &&
      left.orderIndex !== right.orderIndex
    ) {
      return left.orderIndex - right.orderIndex;
    }
    if (left.createdAt < right.createdAt) return -1;
    if (left.createdAt > right.createdAt) return 1;
    return 0;
  });
}

export function reviewPrompt(input: {
  course: Pick<ReviewCourse, "title" | "description" | "level">;
  lessons: ReviewLesson[];
  assignments: ReviewAssignment[];
  materials: ReviewMaterial[];
}) {
  const lessons = sortReviewLessons(input.lessons)
    .map((lesson, index) => {
      const title = (lesson.title ?? "").trim() || "Untitled lesson";
      return `${index + 1}. ${title}\n${(lesson.content ?? "").trim()}`;
    })
    .join("\n\n");
  const assignments = input.assignments
    .map((assignment, index) => {
      const title = (assignment.title ?? "").trim() || "Untitled assignment";
      const due = (assignment.dueDate ?? "").trim() || "No due date";
      return `${index + 1}. ${title}\n${(assignment.description ?? "").trim()}\nDue: ${due}`;
    })
    .join("\n\n");
  const materials = input.materials
    .map((material, index) => `${index + 1}. ${material.fileName} (${material.mimeType})`)
    .join("\n");

  return {
    system: [
      "You review one pending course for an admin. Judge only the course text and the file names in the user message.",
      "Evaluate the course objectives, the lesson structure, the progression from one lesson to the next, and the available material metadata.",
      "Material metadata is a file name and a MIME type. You cannot see file contents.",
      "Do not request a tool. Do not mention students, grades, submissions, or other courses.",
      "recommendation is recommend or revise. revise is advice only and does not change the course status.",
      'Reply with JSON only: {"recommendation":"recommend"|"revise","confidence":number,"summary":string,"findings":string[]}.',
      "confidence is a number from 0 to 1 inclusive.",
      untrustedDataRule,
    ].join(" "),
    user: [
      `Level: ${redactPii(input.course.level.trim())}`,
      `Course title:\n${wrapUntrusted("course", redactPii((input.course.title ?? "").trim()))}`,
      `Course description:\n${wrapUntrusted("course", redactPii((input.course.description ?? "").trim()))}`,
      `Lessons:\n${wrapUntrusted("course", redactPii(lessons || "No lessons."))}`,
      `Assignments:\n${wrapUntrusted("course", redactPii(assignments || "No assignments."))}`,
      `Materials:\n${wrapUntrusted("course", redactPii(materials || "No files."))}`,
    ].join("\n\n"),
  };
}

export function parseReviewReply(
  value: unknown,
): { ok: true; review: StoredReview } | { ok: false; message: string } {
  const record = asRecord(value);
  if (!record) return { ok: false, message: invalidAiMessage };
  const recommendation = enumValue(record["recommendation"], recommendations);
  const confidence = readConfidence(record["confidence"]);
  const summary = requiredText(record, "summary");
  if (!recommendation || !confidence.ok || !summary) {
    return { ok: false, message: invalidAiMessage };
  }

  return {
    ok: true,
    review: {
      recommendation,
      confidence: confidence.confidence,
      lowConfidence: confidence.lowConfidence,
      summary: summary.slice(0, summaryLimit),
      findings: textList(record["findings"], findingCount).map((finding) =>
        finding.slice(0, findingLimit),
      ),
    },
  };
}
