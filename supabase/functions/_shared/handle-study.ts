import { completeJson } from "./gemini.ts";
import { emptyResponse, jsonResponse } from "./http.ts";
import { resolveUserClient } from "./user-client.ts";
import {
  hasLessonContent,
  noLessonContentMessage,
  notAvailableMessage,
  parseStudyReply,
  parseStudyRequest,
  studentOnlyMessage,
  studyAccess,
  studyPrompt,
} from "./study.ts";
import type { StudyReader } from "./study-reader.ts";

export async function handleStudy(
  request: Request,
  deps: {
    supabaseUrl: string | undefined;
    publishableKey: string | undefined;
    geminiKey: string | undefined;
    authorization: string | null;
    reader: StudyReader;
    fetchImpl: typeof fetch;
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

  const parsed = parseStudyRequest(body);
  if (!parsed.ok) return jsonResponse({ ok: false, message: parsed.message });

  const user = await deps.reader.userId();
  if (!user.ok) return jsonResponse({ ok: false, message: user.message }, 401);

  const role = await deps.reader.role(user.userId);
  if (!role.ok) return jsonResponse({ ok: false, message: role.message });
  if (role.role !== "student") {
    return jsonResponse({ ok: false, message: studentOnlyMessage }, 403);
  }

  const course = await deps.reader.course(parsed.courseId);
  if (!course.ok) return jsonResponse({ ok: false, message: course.message });

  const enrollment = course.course
    ? await deps.reader.enrolled(parsed.courseId, user.userId)
    : { ok: true as const, enrolled: false };
  if (!enrollment.ok) return jsonResponse({ ok: false, message: enrollment.message });

  const access = studyAccess({
    role: role.role,
    courseFound: Boolean(course.course),
    enrolled: enrollment.enrolled,
  });
  if (!access.ok) return jsonResponse({ ok: false, message: access.message });
  if (!course.course) return jsonResponse({ ok: false, message: notAvailableMessage });

  const visibleCourse = course.course;
  const lessons = await deps.reader.lessons(parsed.courseId);
  if (!lessons.ok) return jsonResponse({ ok: false, message: lessons.message });
  if (!hasLessonContent(lessons.lessons)) {
    return jsonResponse({ ok: false, message: noLessonContentMessage });
  }

  const prompt = studyPrompt({
    question: parsed.question,
    course: visibleCourse,
    lessons: lessons.lessons,
  });
  const completion = await completeJson(
    { apiKey: deps.geminiKey, system: prompt.system, user: prompt.user },
    deps.fetchImpl,
  );
  if (!completion.ok) return jsonResponse({ ok: false, message: completion.message });

  const reply = parseStudyReply(completion.value);
  if (!reply.ok) return jsonResponse({ ok: false, message: reply.message });

  return jsonResponse({
    ok: true,
    explanation: reply.explanation,
    example: reply.example,
    practiceQuestions: reply.practiceQuestions,
  });
}
