import { invalidAiMessage } from "./gemini.ts";
import {
  agentToolAllowlist,
  asRecord,
  authorizeTool,
  enumValue,
  isCourseId,
  readToolArguments,
  redactPii,
  requiredText,
  trustedToolBlock,
  wrapUntrusted,
} from "./guardrails.ts";

export const assistantMessageLimit = 8;
export const assistantContentLimit = 1000;
export const assistantToolLimit = 3;
export const unfinishedAgentMessage = "I could not finish that request.";
export const questionRequiredMessage = "Enter a question.";
export const studentOnlyAgentMessage = "Only a student can use the learning assistant.";
export const catalogueCountErrorMessage = "The course count could not be loaded.";
export const lessonTextUnavailable = "lesson text is unavailable";
export const enrolledSentence = "You are enrolled in this course.";

export const agentTools = agentToolAllowlist;

export type AgentToolName = (typeof agentTools)[number];

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentCourseRef = {
  id: string;
  title: string;
};

const levelRank = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
} as const;

type LevelName = keyof typeof levelRank;

export type SuggestCourse = {
  id: string;
  title: string | null;
  level: string | null;
  categoryId: string | null;
  createdAt: string;
};

export type SuggestEnrollment = {
  courseId: string;
  status: string;
  level: string | null;
  categoryId: string | null;
};

export function parseAgentMessages(
  body: unknown,
): { ok: true; messages: AgentMessage[] } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || !("messages" in body) || !Array.isArray(body.messages)) {
    return { ok: false, message: questionRequiredMessage };
  }

  const messages: AgentMessage[] = [];
  for (const entry of body.messages) {
    if (!entry || typeof entry !== "object") continue;
    if (!("role" in entry) || (entry.role !== "user" && entry.role !== "assistant")) continue;
    if (!("content" in entry) || typeof entry.content !== "string") continue;
    const content = entry.content.trim().slice(0, assistantContentLimit);
    if (!content) continue;
    messages.push({ role: entry.role, content });
  }

  const latest = messages.slice(-assistantMessageLimit);
  const last = latest.at(-1);
  if (!last || last.role !== "user") return { ok: false, message: questionRequiredMessage };
  return { ok: true, messages: latest };
}

export function enrolRequested(messages: AgentMessage[]) {
  const latestUser = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUser) return false;
  return /\b(enrol|enroll|join)\b/i.test(latestUser.content);
}

export function parseAgentReply(
  value: unknown,
):
  | { ok: true; type: "answer"; text: string; courses: AgentCourseRef[] }
  | { ok: true; type: "tool"; name: string; arguments: Record<string, unknown> }
  | { ok: false; message: string } {
  const record = asRecord(value);
  if (!record) return { ok: false, message: invalidAiMessage };
  const type = enumValue(record["type"], ["answer", "tool"] as const);
  if (type === "answer") {
    const text = requiredText(record, "text");
    if (!text) return { ok: false, message: invalidAiMessage };
    return { ok: true, type: "answer", text, courses: courseRefs(record) };
  }
  if (type === "tool") {
    const name = requiredText(record, "name");
    if (!name) return { ok: false, message: invalidAiMessage };
    return { ok: true, type: "tool", name, arguments: asRecord(record["arguments"]) ?? {} };
  }
  return { ok: false, message: invalidAiMessage };
}

export function isAgentTool(name: string): name is AgentToolName {
  return authorizeTool(name, agentTools);
}

export function courseIdFromArgs(args: Record<string, unknown>) {
  return readToolArguments(args, [{ key: "courseId", type: "uuid" }])["courseId"] ?? "";
}

export function filterAnswerCourses(courses: AgentCourseRef[], allowedIds: ReadonlySet<string>) {
  const seen = new Set<string>();
  return courses.filter((course) => {
    if (!allowedIds.has(course.id) || seen.has(course.id)) return false;
    seen.add(course.id);
    return true;
  });
}

export function publishedCourseCountMessage(count: number) {
  if (count === 0) return "There are no published courses.";
  if (count === 1) return "There is 1 published course.";
  return `There are ${count} published courses.`;
}

export function agentEnrollmentInsert(studentId: string, courseId: string) {
  return {
    student_id: studentId,
    course_id: courseId,
    progress: 0,
    status: "active" as const,
  };
}

export function suggestNextCourse(input: {
  enrollments: SuggestEnrollment[];
  published: SuggestCourse[];
}): AgentCourseRef | null {
  const enrolledIds = new Set(input.enrollments.map((enrollment) => enrollment.courseId));
  const open = input.published.filter((course) => !enrolledIds.has(course.id));
  const completed = input.enrollments.filter((enrollment) => enrollment.status === "completed");
  const categories = new Set(
    completed
      .map((enrollment) => enrollment.categoryId)
      .filter((categoryId): categoryId is string => Boolean(categoryId)),
  );
  const sameCategory = open.filter(
    (course) => course.categoryId !== null && categories.has(course.categoryId),
  );
  if (sameCategory.length > 0) {
    const course = newest(sameCategory);
    if (course) return courseRef(course);
  }

  const nextLevel = levelAfter(completed);
  if (nextLevel) {
    const leveled = open.filter((course) => course.level === nextLevel);
    if (leveled.length > 0) {
      const course = newest(leveled);
      if (course) return courseRef(course);
    }
  }
  const fallback = newest(open);
  return fallback ? courseRef(fallback) : null;
}

export function parseAssistantResult(
  value: unknown,
):
  | { ok: true; text: string; courses: AgentCourseRef[]; enrolled: AgentCourseRef | null }
  | { ok: false; message: string } {
  if (!value || typeof value !== "object" || !("text" in value) || typeof value.text !== "string") {
    return { ok: false, message: invalidAiMessage };
  }
  const text = value.text.trim();
  if (!text) return { ok: false, message: invalidAiMessage };
  const enrolled =
    "enrolled" in value && value.enrolled && typeof value.enrolled === "object"
      ? (courseRefs({ courses: [value.enrolled] })[0] ?? null)
      : null;
  return { ok: true, text, courses: courseRefs(value), enrolled };
}

export function agentUserPrompt(messages: AgentMessage[], toolResults: unknown[]) {
  const history = messages
    .map((message) => wrapUntrusted(message.role, redactPii(message.content)))
    .join("\n");
  if (toolResults.length === 0) return history;
  return `${history}\n${trustedToolBlock(toolResults)}`;
}

function courseRefs(value: object): AgentCourseRef[] {
  if (!("courses" in value) || !Array.isArray(value.courses)) return [];
  const courses: AgentCourseRef[] = [];
  for (const course of value.courses) {
    if (!course || typeof course !== "object") continue;
    if (!("id" in course) || typeof course.id !== "string" || !isCourseId(course.id)) {
      continue;
    }
    const title = "title" in course && typeof course.title === "string" ? course.title.trim() : "";
    courses.push({ id: course.id, title });
  }
  return courses;
}

function levelAfter(completed: SuggestEnrollment[]): LevelName | null {
  let highest = -1;
  for (const enrollment of completed) {
    if (
      enrollment.level === "beginner" ||
      enrollment.level === "intermediate" ||
      enrollment.level === "advanced"
    ) {
      highest = Math.max(highest, levelRank[enrollment.level]);
    }
  }
  if (highest === 0) return "intermediate";
  if (highest === 1) return "advanced";
  return null;
}

function newest(courses: SuggestCourse[]) {
  return (
    [...courses].sort((left, right) => {
      if (left.createdAt === right.createdAt) return left.id.localeCompare(right.id);
      return right.createdAt.localeCompare(left.createdAt);
    })[0] ?? null
  );
}

function courseRef(course: SuggestCourse): AgentCourseRef {
  return { id: course.id, title: course.title?.trim() || "Untitled course" };
}
