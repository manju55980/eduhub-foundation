import { withThreadHistory, type ThreadMessage } from "./ai-thread.ts";
import {
  asRecord,
  enumValue,
  isCourseId,
  readConfidence,
  redactPii,
  requiredText,
  trustedToolBlock,
  untrustedDataRule,
  wrapUntrusted,
} from "./guardrails.ts";

export const tutorContentLimit = 1000;
export const tutorMatchCount = 5;
export const tutorChatTimeoutMs = 45_000;

export const noLessonsMessage = "This course has no lessons yet.";
export const lowConfidencePlanMessage = "This request was refused because confidence was too low.";
export const noEvidenceMessage = "This answer was not graded because no course evidence was found.";
export const lowConfidenceGradeMessage =
  "This answer was not graded because confidence was too low.";
export const lowConfidenceQuestionMessage =
  "A question could not be asked because confidence was too low.";
export const studentOnlyTutorMessage = "Only a student can use the course tutor.";
export const answerRequiredMessage = "Enter an answer.";
export const answerLimitMessage = "The answer must be 1,000 characters or fewer.";
export const questionLimitMessage = "The question must be 1,000 characters or fewer.";

export const tutorVerdicts = ["supported", "partial", "unsupported"] as const;

export type TutorVerdict = (typeof tutorVerdicts)[number];

export type TutorLesson = {
  id: string;
  title: string | null;
  orderIndex: number;
};

export type TutorChunk = {
  id: string;
  sourceType: string | null;
  title: string | null;
  body: string | null;
  courseId: string | null;
  similarity: number | null;
};

export type TutorPlanItem = {
  id: string;
  title: string;
  orderIndex: number;
};

export type TutorContextItem = {
  id: string;
  sourceType: string | null;
  title: string;
  body: string;
  similarity: number | null;
};

export type TutorCitation = {
  id: string;
  title: string;
};

export type TutorFeedback = {
  verdict: TutorVerdict;
  feedback: string;
  citations: TutorCitation[];
};

export const tutorDifficulties = ["starting", "easier", "harder"] as const;
export type TutorDifficulty = (typeof tutorDifficulties)[number];

export type TutorQuestion = {
  mode: "question";
  refused: false;
  question: string;
  difficulty: TutorDifficulty;
  plan: TutorPlanItem[];
};

export type TutorTrace = {
  mode: "grade";
  refused: false;
  question: string;
  plan: TutorPlanItem[];
  context: TutorContextItem[];
  feedback: TutorFeedback;
};

export type TutorRefusal = {
  refused: true;
  message: string;
};

export function parseTutorRequest(
  body: unknown,
):
  | { ok: true; mode: "question"; courseId: string }
  | { ok: true; mode: "grade"; courseId: string; question: string; answer: string }
  | { ok: false; message: string } {
  const record = asRecord(body);
  if (!record) return { ok: false, message: "The request was not valid." };

  const courseId = requiredText(record, "courseId") ?? "";
  const mode = enumValue(record["mode"], ["question", "grade"] as const);
  if (!isCourseId(courseId) || !mode)
    return { ok: false, message: "This course is not available." };
  if (mode === "question") return { ok: true, mode, courseId };

  const question = requiredText(record, "question") ?? "";
  const answer = requiredText(record, "answer") ?? "";
  if (!question || question.length > tutorContentLimit) {
    return { ok: false, message: questionLimitMessage };
  }
  if (!answer) return { ok: false, message: answerRequiredMessage };
  if (answer.length > tutorContentLimit) return { ok: false, message: answerLimitMessage };
  return { ok: true, mode, courseId, question, answer };
}

export function lessonTitle(lesson: { title: string | null }) {
  const title = lesson.title?.trim() ?? "";
  return title || "Untitled lesson";
}

export function chunkTitle(chunk: { title: string | null }) {
  const title = chunk.title?.trim() ?? "";
  return title || "Untitled";
}

export function parseTutorPlan(
  value: unknown,
  lessons: TutorLesson[],
): { ok: true; plan: TutorPlanItem[] } | { ok: false; kind: "invalid" | "refused" } {
  const record = asRecord(value);
  if (!record) return { ok: false, kind: "invalid" };
  const confidence = readConfidence(record["confidence"]);
  if (!confidence.ok) return { ok: false, kind: "invalid" };
  if (confidence.lowConfidence) return { ok: false, kind: "refused" };
  if (!Array.isArray(record["lessons"])) return { ok: false, kind: "invalid" };

  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const seen = new Set<string>();
  const plan: TutorPlanItem[] = [];
  for (const item of record["lessons"]) {
    const row = asRecord(item);
    if (!row) continue;
    const id = requiredText(row, "id");
    const reason = requiredText(row, "reason");
    if (!id || !reason || seen.has(id)) continue;
    const lesson = byId.get(id);
    if (!lesson) continue;
    seen.add(id);
    plan.push({ id: lesson.id, title: lessonTitle(lesson), orderIndex: lesson.orderIndex });
  }
  if (plan.length === 0) return { ok: false, kind: "refused" };
  return { ok: true, plan };
}

export function keepTutorChunks(chunks: TutorChunk[], courseId: string) {
  return chunks.filter((chunk) => {
    if (!chunk.id) return false;
    if (chunk.sourceType === "faq") return true;
    return (
      (chunk.sourceType === "course" || chunk.sourceType === "lesson") &&
      chunk.courseId === courseId
    );
  });
}

export function toTutorContext(chunks: TutorChunk[]): TutorContextItem[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    sourceType: chunk.sourceType,
    title: chunkTitle(chunk),
    body: chunk.body ?? "",
    similarity: chunk.similarity,
  }));
}

export function parseTutorGrade(
  value: unknown,
  context: TutorContextItem[],
): { ok: true; feedback: TutorFeedback } | { ok: false; kind: "invalid" | "refused" } {
  const record = asRecord(value);
  if (!record) return { ok: false, kind: "invalid" };
  const confidence = readConfidence(record["confidence"]);
  if (!confidence.ok) return { ok: false, kind: "invalid" };
  if (confidence.lowConfidence) return { ok: false, kind: "refused" };

  const verdict = enumValue(record["verdict"], tutorVerdicts);
  const feedback = requiredText(record, "feedback");
  if (!verdict || !feedback) return { ok: false, kind: "refused" };

  const allowed = new Map(context.map((chunk) => [chunk.id, chunk]));
  const seen = new Set<string>();
  const citations: TutorCitation[] = [];
  if (Array.isArray(record["citations"])) {
    for (const item of record["citations"]) {
      if (typeof item !== "string") continue;
      const id = item.trim();
      const chunk = allowed.get(id);
      if (!id || !chunk || seen.has(id)) continue;
      seen.add(id);
      citations.push({ id, title: chunk.title });
    }
  }
  if (citations.length === 0) return { ok: false, kind: "refused" };
  return { ok: true, feedback: { verdict, feedback, citations } };
}

export function parseTutorQuestion(
  value: unknown,
  context: TutorContextItem[],
): { ok: true; question: string } | { ok: false; kind: "invalid" | "refused" } {
  const record = asRecord(value);
  if (!record) return { ok: false, kind: "invalid" };
  const confidence = readConfidence(record["confidence"]);
  if (!confidence.ok) return { ok: false, kind: "invalid" };
  if (confidence.lowConfidence) return { ok: false, kind: "refused" };
  const question = requiredText(record, "question");
  if (!question) return { ok: false, kind: "refused" };

  const allowed = new Set(context.map((chunk) => chunk.id));
  const cited = Array.isArray(record["citations"])
    ? record["citations"].some(
        (item) => typeof item === "string" && allowed.has(item.trim()) && item.trim().length > 0,
      )
    : false;
  if (!cited) return { ok: false, kind: "refused" };
  return { ok: true, question };
}

export function parseTutorResult(
  value: unknown,
):
  { ok: true; result: TutorQuestion | TutorTrace | TutorRefusal } | { ok: false; message: string } {
  const record = asRecord(value);
  if (!record || typeof record["refused"] !== "boolean") {
    return { ok: false, message: "The AI response was not valid." };
  }
  if (record["refused"] === true) {
    const message = requiredText(record, "message");
    if (!message) return { ok: false, message: "The AI response was not valid." };
    return { ok: true, result: { refused: true, message } };
  }

  const plan = planItems(record["plan"]);
  const question = requiredText(record, "question");
  if (!plan || !question) return { ok: false, message: "The AI response was not valid." };
  if (record["mode"] === "question") {
    const difficulty = enumValue(record["difficulty"], tutorDifficulties) ?? "starting";
    return { ok: true, result: { mode: "question", refused: false, question, difficulty, plan } };
  }
  const context = contextItems(record["context"]);
  const feedback = feedbackItem(record["feedback"]);
  if (record["mode"] !== "grade" || !context || !feedback) {
    return { ok: false, message: "The AI response was not valid." };
  }
  return {
    ok: true,
    result: { mode: "grade", refused: false, question, plan, context, feedback },
  };
}

function planItems(value: unknown): TutorPlanItem[] | null {
  if (!Array.isArray(value)) return null;
  const plan: TutorPlanItem[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const id = row ? requiredText(row, "id") : null;
    const title = row ? requiredText(row, "title") : null;
    const orderIndex = row?.["orderIndex"];
    if (!row || !id || !title || typeof orderIndex !== "number") return null;
    plan.push({ id, title, orderIndex });
  }
  return plan;
}

function contextItems(value: unknown): TutorContextItem[] | null {
  if (!Array.isArray(value)) return null;
  const context: TutorContextItem[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const id = row ? requiredText(row, "id") : null;
    const title = row ? requiredText(row, "title") : null;
    if (!row || !id || !title || typeof row["body"] !== "string") return null;
    const similarity = row["similarity"];
    context.push({
      id,
      sourceType: typeof row["sourceType"] === "string" ? row["sourceType"] : null,
      title,
      body: row["body"],
      similarity: typeof similarity === "number" ? similarity : null,
    });
  }
  return context;
}

function feedbackItem(value: unknown): TutorFeedback | null {
  const feedback = asRecord(value);
  const verdict = feedback ? enumValue(feedback["verdict"], tutorVerdicts) : null;
  const text = feedback ? requiredText(feedback, "feedback") : null;
  if (!feedback || !verdict || !text || !Array.isArray(feedback["citations"])) return null;
  const citations: TutorCitation[] = [];
  for (const item of feedback["citations"]) {
    const row = asRecord(item);
    const id = row ? requiredText(row, "id") : null;
    const title = row ? requiredText(row, "title") : null;
    if (!id || !title) return null;
    citations.push({ id, title });
  }
  if (citations.length === 0) return null;
  return { verdict, feedback: text, citations };
}

export function retrievalQuery(input: {
  courseTitle: string | null;
  plan: TutorPlanItem[];
  question: string | null;
}) {
  if (input.question) return redactPii(input.question);
  const course = (input.courseTitle ?? "").trim() || "Untitled course";
  const lesson = input.plan[0]?.title ?? course;
  return redactPii(`${course}\n${lesson}`);
}

export function plannerPrompt(input: {
  courseTitle: string | null;
  lessons: TutorLesson[];
  question: string | null;
  history?: ThreadMessage[];
}) {
  const lessons = [...input.lessons].sort(
    (a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id),
  );
  const lines = lessons.map(
    (lesson) => `- ${lesson.id} | ${lesson.orderIndex} | ${lessonTitle(lesson)}`,
  );
  return {
    system: [
      "You are the planner for one enrolled course.",
      'Return JSON only: {"confidence": number, "lessons": [{"id": string, "reason": string}]}.',
      "confidence is from 0 to 1.",
      "lessons is an ordered learning path. Use only lesson ids from the course list.",
      "Do not invent a lesson id.",
      untrustedDataRule,
    ].join(" "),
    user: withThreadHistory(
      [
        `Course: ${(input.courseTitle ?? "").trim() || "Untitled course"}`,
        "Lessons:",
        ...lines,
        input.question
          ? wrapUntrusted("question", redactPii(input.question))
          : "Task: Order these lessons for one question a student can answer.",
      ].join("\n"),
      input.history ?? [],
    ),
  };
}

export function nextDifficulty(messages: ThreadMessage[]): TutorDifficulty {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "assistant") continue;
    const verdict = message.content.trim().toLowerCase().split(":")[0];
    if (verdict === "supported") return "harder";
    if (verdict === "partial" || verdict === "unsupported") return "easier";
  }
  return "starting";
}

export function difficultyInstruction(difficulty: TutorDifficulty) {
  if (difficulty === "harder") {
    return "Ask a harder question than the last one. Ask the student to connect two facts from the retrieved chunks. The question must still be answered only from those chunks.";
  }
  if (difficulty === "easier") {
    return "Ask an easier question than the last one. Ask for one fact the retrieved chunks state directly. Use short words.";
  }
  return "Ask one straightforward question that the retrieved chunks can answer.";
}

export function questionPrompt(input: {
  plan: TutorPlanItem[];
  context: TutorContextItem[];
  history?: ThreadMessage[];
  difficulty?: TutorDifficulty;
}) {
  const plan = input.plan.map((lesson) => `- ${lesson.id} | ${lesson.title}`).join("\n");
  const difficulty = input.difficulty ?? "starting";
  return {
    system: [
      "You write one question for a student.",
      'Return JSON only: {"confidence": number, "question": string, "citations": string[]}.',
      "confidence is from 0 to 1.",
      "The question must be answerable from the retrieved chunks.",
      difficultyInstruction(difficulty),
      "Cite the chunk ids the question depends on.",
      "Do not include the answer.",
      "Do not return a numeric score.",
      untrustedDataRule,
    ].join(" "),
    user: withThreadHistory(
      [
        "Plan:",
        plan,
        trustedToolBlock(
          input.context.map((chunk) => ({
            id: chunk.id,
            sourceType: chunk.sourceType,
            title: chunk.title,
            body: chunk.body,
          })),
        ),
      ].join("\n"),
      input.history ?? [],
    ),
  };
}

export function graderPrompt(input: {
  question: string;
  answer: string;
  plan: TutorPlanItem[];
  context: TutorContextItem[];
  history?: ThreadMessage[];
}) {
  const plan = input.plan.map((lesson) => `- ${lesson.id} | ${lesson.title}`).join("\n");
  return {
    system: [
      "You are the grader for one short answer.",
      'Return JSON only: {"confidence": number, "verdict": "supported" | "partial" | "unsupported", "feedback": string, "citations": string[]}.',
      "confidence is from 0 to 1.",
      "Judge the answer only with the retrieved chunks.",
      "Every citation must be a chunk id from that list.",
      "Do not return a numeric score.",
      "Do not give a verdict without a citation.",
      untrustedDataRule,
    ].join(" "),
    user: withThreadHistory(
      [
        "Plan:",
        plan,
        trustedToolBlock(
          input.context.map((chunk) => ({
            id: chunk.id,
            sourceType: chunk.sourceType,
            title: chunk.title,
            body: chunk.body,
          })),
        ),
        wrapUntrusted("question", redactPii(input.question)),
        wrapUntrusted("answer", redactPii(input.answer)),
      ].join("\n"),
      input.history ?? [],
    ),
  };
}
