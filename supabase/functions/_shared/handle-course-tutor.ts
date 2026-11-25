import type { TutorReader } from "./course-tutor-reader.ts";
import {
  graderPrompt,
  keepTutorChunks,
  lowConfidenceGradeMessage,
  lowConfidencePlanMessage,
  lowConfidenceQuestionMessage,
  noEvidenceMessage,
  nextDifficulty,
  noLessonsMessage,
  parseTutorGrade,
  parseTutorPlan,
  parseTutorQuestion,
  parseTutorRequest,
  plannerPrompt,
  questionPrompt,
  retrievalQuery,
  studentOnlyTutorMessage,
  toTutorContext,
  tutorChatTimeoutMs,
  tutorMatchCount,
  type TutorContextItem,
  type TutorPlanItem,
} from "./course-tutor.ts";
import {
  embeddingLiteral,
  embeddingRejectedMessage,
  embedTextsWithOllama,
  withGeminiTimeout,
} from "./embeddings.ts";
import { enforceAiRateLimit, type AiRateDb } from "./ai-rate-limit.ts";
import {
  contextContentLimit,
  openThreadTurn,
  persistThreadTurn,
  readThreadId,
  type AiThreadStore,
  type AiTurnWrite,
  type ThreadMessage,
} from "./ai-thread.ts";
import { keywordQuery } from "./hybrid-search.ts";
import { authorizeTool, isToolShaped, noToolAllowlist, toolName } from "./guardrails.ts";
import { completeChat, geminiFallbackModel, invalidAiMessage, missingAiMessage } from "./gemini.ts";
import { emptyResponse, jsonResponse } from "./http.ts";
import { notAvailableMessage } from "./study.ts";
import { resolveUserClient } from "./user-client.ts";

export async function handleCourseTutor(
  request: Request,
  deps: {
    supabaseUrl: string | undefined;
    publishableKey: string | undefined;
    geminiKey: string | undefined;
    ollamaHost?: string;
    authorization: string | null;
    reader: TutorReader;
    fetchImpl: typeof fetch;
    rateLimit?: AiRateDb;
    threads?: AiThreadStore;
  },
) {
  if (request.method === "OPTIONS") return emptyResponse(204);
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
  }

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

  const parsed = parseTutorRequest(body);
  if (!parsed.ok) return jsonResponse({ ok: false, message: parsed.message });

  const user = await deps.reader.userId();
  if (!user.ok) return jsonResponse({ ok: false, message: user.message }, 401);

  const role = await deps.reader.role(user.userId);
  if (!role.ok) return jsonResponse({ ok: false, message: role.message });
  if (role.role !== "student") {
    return jsonResponse({ ok: false, message: studentOnlyTutorMessage }, 403);
  }

  const course = await deps.reader.course(parsed.courseId);
  if (!course.ok) return jsonResponse({ ok: false, message: course.message });
  if (!course.course) return jsonResponse({ ok: false, message: notAvailableMessage });

  const enrollment = await deps.reader.enrolled(parsed.courseId, user.userId);
  if (!enrollment.ok) return jsonResponse({ ok: false, message: enrollment.message });
  if (!enrollment.enrolled) return jsonResponse({ ok: false, message: notAvailableMessage });

  const lessons = await deps.reader.lessons(parsed.courseId);
  if (!lessons.ok) return jsonResponse({ ok: false, message: lessons.message });
  if (lessons.lessons.length === 0) return jsonResponse({ ok: false, message: noLessonsMessage });

  const threadRef = readThreadId(body);
  if (!threadRef.ok) return jsonResponse({ ok: false, message: threadRef.message });
  const slots = parsed.mode === "question" ? 4 : 2;
  const turn = await openThreadTurn(deps.threads, {
    threadId: threadRef.threadId,
    surface: "tutor",
    courseId: parsed.courseId,
    slots,
  });
  if (!turn.ok) return jsonResponse({ ok: false, message: turn.message }, turn.status);
  const history: ThreadMessage[] = turn.active ? turn.messages : [];
  const saveTurn = async (
    input: Omit<AiTurnWrite, "threadId" | "surface" | "courseId" | "slots">,
  ) => {
    const saved = await persistThreadTurn(deps.threads, turn.active, {
      ...input,
      threadId: threadRef.threadId ?? "",
      surface: "tutor",
      courseId: parsed.courseId,
      slots,
    });
    if (!saved.ok) return jsonResponse({ ok: false, message: saved.message }, saved.status);
    return null;
  };

  if (!deps.geminiKey?.trim()) return jsonResponse({ ok: false, message: missingAiMessage });

  const allowance = await enforceAiRateLimit(deps.rateLimit, "ai-tutor");
  if (!allowance.ok) {
    return jsonResponse({ ok: false, message: allowance.message }, allowance.status);
  }

  const modelFetch = withGeminiTimeout(deps.fetchImpl, tutorChatTimeoutMs);
  const focus = parsed.mode === "grade" ? parsed.question : null;
  const planPrompt = plannerPrompt({
    courseTitle: course.course.title,
    lessons: lessons.lessons,
    question: focus,
    history,
  });
  const planned = await completeTutor(
    { apiKey: deps.geminiKey, system: planPrompt.system, user: planPrompt.user },
    modelFetch,
  );
  if (!planned.ok) return jsonResponse({ ok: false, message: planned.message });
  if (rejectTool(planned.value)) return jsonResponse({ ok: false, message: invalidAiMessage });

  const plan = parseTutorPlan(planned.value, lessons.lessons);
  if (!plan.ok) {
    if (plan.kind === "invalid") return jsonResponse({ ok: false, message: invalidAiMessage });
    const blocked = await saveTurn({
      userContent: tutorUserContent(parsed),
      assistantContent: lowConfidencePlanMessage,
      payload: { refused: true, message: lowConfidencePlanMessage },
    });
    if (blocked) return blocked;
    return jsonResponse({ ok: true, refused: true, message: lowConfidencePlanMessage });
  }

  const embedded = await embedTextsWithOllama(
    {
      host: deps.ollamaHost,
      texts: [
        retrievalQuery({
          courseTitle: course.course.title,
          plan: plan.plan,
          question: focus,
        }),
      ],
      taskType: "RETRIEVAL_QUERY",
      maxAttempts: 1,
    },
    deps.fetchImpl,
  );
  if (!embedded.ok) return jsonResponse({ ok: false, message: embedded.message });
  const values = embedded.vectors[0];
  if (!values) return jsonResponse({ ok: false, message: embeddingRejectedMessage });

  const queryText = keywordQuery(
    retrievalQuery({
      courseTitle: course.course.title,
      plan: plan.plan,
      question: focus,
    }),
  );
  const found = deps.reader.retrieveHybrid
    ? await deps.reader.retrieveHybrid(embeddingLiteral(values), queryText)
    : await deps.reader.matchKnowledge(embeddingLiteral(values));
  if (!found.ok) return jsonResponse({ ok: false, message: found.message });

  const context = toTutorContext(
    keepTutorChunks(found.matches, parsed.courseId).slice(0, tutorMatchCount),
  );
  if (context.length === 0) {
    const blocked = await saveTurn({
      userContent: tutorUserContent(parsed),
      assistantContent: noEvidenceMessage,
      payload: { refused: true, message: noEvidenceMessage },
    });
    if (blocked) return blocked;
    return jsonResponse({ ok: true, refused: true, message: noEvidenceMessage });
  }

  if (parsed.mode === "question") {
    return askQuestion(deps.geminiKey, modelFetch, plan.plan, context, history, saveTurn);
  }
  return gradeAnswer(
    deps.geminiKey,
    modelFetch,
    parsed.question,
    parsed.answer,
    plan.plan,
    context,
    history,
    saveTurn,
  );
}

function rejectTool(value: unknown) {
  return isToolShaped(value) && !authorizeTool(toolName(value), noToolAllowlist);
}

type TutorSave = (
  input: Omit<AiTurnWrite, "threadId" | "surface" | "courseId" | "slots">,
) => Promise<Response | null>;

function tutorUserContent(parsed: { mode: "question" } | { mode: "grade"; answer: string }) {
  return parsed.mode === "question" ? "Give me a question" : parsed.answer;
}

async function askQuestion(
  geminiKey: string,
  fetchImpl: typeof fetch,
  plan: TutorPlanItem[],
  context: TutorContextItem[],
  history: ThreadMessage[],
  saveTurn: TutorSave,
) {
  const difficulty = nextDifficulty(history);
  const prompt = questionPrompt({ plan, context, history, difficulty });
  const asked = await completeTutor(
    { apiKey: geminiKey, system: prompt.system, user: prompt.user },
    fetchImpl,
  );
  if (!asked.ok) return jsonResponse({ ok: false, message: asked.message });
  if (rejectTool(asked.value)) return jsonResponse({ ok: false, message: invalidAiMessage });

  const question = parseTutorQuestion(asked.value, context);
  if (!question.ok) {
    if (question.kind === "invalid") return jsonResponse({ ok: false, message: invalidAiMessage });
    const blocked = await saveTurn({
      userContent: "Give me a question",
      assistantContent: lowConfidenceQuestionMessage,
      payload: { refused: true, message: lowConfidenceQuestionMessage },
    });
    if (blocked) return blocked;
    return jsonResponse({ ok: true, refused: true, message: lowConfidenceQuestionMessage });
  }

  const blocked = await saveTurn({
    userContent: "Give me a question",
    assistantContent: question.question.slice(0, contextContentLimit),
    payload: {
      mode: "question",
      refused: false,
      question: question.question,
      difficulty,
      plan,
    },
  });
  if (blocked) return blocked;

  return jsonResponse({
    ok: true,
    mode: "question",
    refused: false,
    question: question.question,
    difficulty,
    plan,
  });
}

async function gradeAnswer(
  geminiKey: string,
  fetchImpl: typeof fetch,
  question: string,
  answer: string,
  plan: TutorPlanItem[],
  context: TutorContextItem[],
  history: ThreadMessage[],
  saveTurn: TutorSave,
) {
  const prompt = graderPrompt({ question, answer, plan, context, history });
  const graded = await completeTutor(
    { apiKey: geminiKey, system: prompt.system, user: prompt.user },
    fetchImpl,
  );
  if (!graded.ok) return jsonResponse({ ok: false, message: graded.message });
  if (rejectTool(graded.value)) return jsonResponse({ ok: false, message: invalidAiMessage });

  const feedback = parseTutorGrade(graded.value, context);
  if (!feedback.ok) {
    if (feedback.kind === "invalid") return jsonResponse({ ok: false, message: invalidAiMessage });
    const blocked = await saveTurn({
      userContent: answer,
      assistantContent: lowConfidenceGradeMessage,
      payload: { refused: true, message: lowConfidenceGradeMessage },
    });
    if (blocked) return blocked;
    return jsonResponse({ ok: true, refused: true, message: lowConfidenceGradeMessage });
  }

  const transcript = `${feedback.feedback.verdict}: ${feedback.feedback.feedback}`.slice(
    0,
    contextContentLimit,
  );
  const blocked = await saveTurn({
    userContent: answer,
    assistantContent: transcript,
    payload: {
      mode: "grade",
      refused: false,
      question,
      plan,
      context,
      feedback: feedback.feedback,
    },
  });
  if (blocked) return blocked;

  return jsonResponse({
    ok: true,
    mode: "grade",
    refused: false,
    question,
    plan,
    context,
    feedback: feedback.feedback,
  });
}

function completeTutor(
  input: { apiKey: string; system: string; user: string },
  fetchImpl: typeof fetch,
) {
  return completeChat(input, fetchImpl, { fallbackModel: geminiFallbackModel });
}
