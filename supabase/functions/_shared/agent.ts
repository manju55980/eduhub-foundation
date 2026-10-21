import { invalidAiMessage } from "./gemini.ts";

export const assistantMessageLimit = 8;
export const assistantContentLimit = 1000;
export const assistantToolLimit = 3;
export const unfinishedAgentMessage = "I could not finish that request.";
export const questionRequiredMessage = "Enter a question.";
export const studentOnlyAgentMessage = "Only a student can use the learning assistant.";
export const catalogueCountErrorMessage = "The course count could not be loaded.";
export const lessonTextUnavailable = "lesson text is unavailable";
export const enrolledSentence = "You are enrolled in this course.";

const courseIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const agentTools = [
  "search_catalogue",
  "describe_course",
  "enrol_in_course",
  "fetch_my_grades",
  "suggest_next_course",
  "count_published_courses",
] as const;

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
  if (!value || typeof value !== "object" || !("type" in value)) {
    return { ok: false, message: invalidAiMessage };
  }
  if (value.type === "answer") {
    if (!("text" in value) || typeof value.text !== "string" || !value.text.trim()) {
      return { ok: false, message: invalidAiMessage };
    }
    return { ok: true, type: "answer", text: value.text.trim(), courses: courseRefs(value) };
  }
  if (value.type === "tool") {
    if (!("name" in value) || typeof value.name !== "string" || !value.name.trim()) {
      return { ok: false, message: invalidAiMessage };
    }
    const args =
      "arguments" in value && value.arguments && typeof value.arguments === "object"
        ? (value.arguments as Record<string, unknown>)
        : {};
    return { ok: true, type: "tool", name: value.name.trim(), arguments: args };
  }
  return { ok: false, message: invalidAiMessage };
}

export function isAgentTool(name: string): name is AgentToolName {
  return agentTools.some((tool) => tool === name);
}

export function courseIdFromArgs(args: Record<string, unknown>) {
  const courseId =
    "courseId" in args && typeof args.courseId === "string" ? args.courseId.trim() : "";
  return courseIdPattern.test(courseId) ? courseId : "";
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
  if (sameCategory.length > 0) return courseRef(newest(sameCategory));

  const nextLevel = levelAfter(completed);
  if (nextLevel) {
    const leveled = open.filter((course) => course.level === nextLevel);
    if (leveled.length > 0) return courseRef(newest(leveled));
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

export function agentSystemPrompt() {
  return [
    "You are the EduHub learning assistant for one signed-in student.",
    "Use only the tool results in this conversation. Do not invent courses, lessons, grades, or enrolment.",
    "Reply with JSON only.",
    'An answer is {"type":"answer","text":"...","courses":[{"id":"...","title":"..."}]}.',
    'A tool call is {"type":"tool","name":"search_catalogue|describe_course|enrol_in_course|fetch_my_grades|suggest_next_course|count_published_courses","arguments":{}}.',
    "search_catalogue arguments: {query}. describe_course and enrol_in_course arguments: {courseId}.",
    "fetch_my_grades, suggest_next_course, and count_published_courses arguments: {}.",
    "Use count_published_courses when the student asks how many courses there are. Report that count. Do not count search_catalogue matches.",
    "Course ids in an answer must be ids returned by a tool in this conversation.",
    "Call enrol_in_course only when the student asks to enrol or join a course.",
  ].join(" ");
}

export function agentUserPrompt(messages: AgentMessage[], toolResults: unknown[]) {
  const history = messages.map((message) => `${message.role}: ${message.content}`).join("\n");
  if (toolResults.length === 0) return history;
  const results = toolResults.map((result) => `tool: ${JSON.stringify(result)}`).join("\n");
  return `${history}\n${results}`;
}

function courseRefs(value: object): AgentCourseRef[] {
  if (!("courses" in value) || !Array.isArray(value.courses)) return [];
  const courses: AgentCourseRef[] = [];
  for (const course of value.courses) {
    if (!course || typeof course !== "object") continue;
    if (!("id" in course) || typeof course.id !== "string" || !courseIdPattern.test(course.id)) {
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
