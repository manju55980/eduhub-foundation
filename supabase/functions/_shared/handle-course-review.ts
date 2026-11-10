import {
  adminOnlyMessage,
  courseIdFromBody,
  notWaitingMessage,
  parseReviewReply,
  reviewPrompt,
} from "./course-review.ts";
import { enforceAiRateLimit, type AiRateDb } from "./ai-rate-limit.ts";
import { completeJson, invalidAiMessage, missingAiMessage } from "./gemini.ts";
import { authorizeTool, isToolShaped, noToolAllowlist, toolName } from "./guardrails.ts";
import { emptyResponse, jsonResponse } from "./http.ts";
import type { ReviewReader } from "./review-reader.ts";
import { resolveUserClient } from "./user-client.ts";

export async function handleCourseReview(
  request: Request,
  deps: {
    supabaseUrl: string | undefined;
    publishableKey: string | undefined;
    geminiKey: string | undefined;
    authorization: string | null;
    reader: ReviewReader;
    fetchImpl: typeof fetch;
    rateLimit?: AiRateDb;
  },
) {
  if (request.method === "OPTIONS") return emptyResponse(204);
  if (request.method !== "POST")
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405);

  const client = resolveUserClient({
    supabaseUrl: deps.supabaseUrl,
    publishableKey: deps.publishableKey,
    authorization: deps.authorization,
  });
  if (!client.ok) return jsonResponse({ ok: false, message: client.message }, client.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "The request was not valid." });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ ok: false, message: "The request was not valid." });
  }

  const user = await deps.reader.userId();
  if (!user.ok) return jsonResponse({ ok: false, message: user.message }, 401);

  const role = await deps.reader.role(user.userId);
  if (!role.ok) return jsonResponse({ ok: false, message: role.message });
  if (role.role !== "admin") return jsonResponse({ ok: false, message: adminOnlyMessage }, 403);

  const parsed = courseIdFromBody(body);
  if (!parsed.ok) return jsonResponse({ ok: false, message: parsed.message });

  const course = await deps.reader.course(parsed.courseId);
  if (!course.ok) return jsonResponse({ ok: false, message: course.message });
  if (!course.course || course.course.status !== "pending") {
    return jsonResponse({ ok: false, message: notWaitingMessage });
  }

  const lessons = await deps.reader.lessons(parsed.courseId);
  if (!lessons.ok) return jsonResponse({ ok: false, message: lessons.message });
  const assignments = await deps.reader.assignments(parsed.courseId);
  if (!assignments.ok) return jsonResponse({ ok: false, message: assignments.message });
  const materials = await deps.reader.materials(parsed.courseId);
  if (!materials.ok) return jsonResponse({ ok: false, message: materials.message });

  if (!deps.geminiKey?.trim()) return jsonResponse({ ok: false, message: missingAiMessage });

  const allowance = await enforceAiRateLimit(deps.rateLimit, "ai-course-review");
  if (!allowance.ok) {
    return jsonResponse({ ok: false, message: allowance.message }, allowance.status);
  }

  const prompt = reviewPrompt({
    course: course.course,
    lessons: lessons.lessons,
    assignments: assignments.assignments,
    materials: materials.materials,
  });
  const completion = await completeJson(
    { apiKey: deps.geminiKey, system: prompt.system, user: prompt.user },
    deps.fetchImpl,
  );
  if (!completion.ok) return jsonResponse({ ok: false, message: completion.message });
  if (
    isToolShaped(completion.value) &&
    !authorizeTool(toolName(completion.value), noToolAllowlist)
  ) {
    return jsonResponse({ ok: false, message: invalidAiMessage });
  }

  const reply = parseReviewReply(completion.value);
  if (!reply.ok) return jsonResponse({ ok: false, message: reply.message });

  const saved = await deps.reader.insertReview({
    course_id: parsed.courseId,
    recommendation: reply.review.recommendation,
    confidence: reply.review.confidence,
    summary: reply.review.summary,
    findings: reply.review.findings,
  });
  if (!saved.ok) return jsonResponse({ ok: false, message: saved.message });

  return jsonResponse({
    ok: true,
    recommendation: saved.review.recommendation,
    confidence: saved.review.confidence,
    lowConfidence: saved.review.lowConfidence,
    summary: saved.review.summary,
    findings: saved.review.findings,
  });
}
