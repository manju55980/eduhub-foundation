import {
  agentUserPrompt,
  enrolRequested,
  type AgentCourseRef,
  type AgentMessage,
  type AgentToolName,
} from "./agent.ts";
import {
  asRecord,
  confidenceValue,
  enumValue,
  isLowConfidence,
  redactPii,
  requiredText,
  trustedToolRule,
  untrustedDataRule,
  wrapUntrusted,
} from "./guardrails.ts";

export const specialistNames = ["tutor", "advisor", "enrolment"] as const;

export type SpecialistName = (typeof specialistNames)[number];

export const lowConfidenceEnrolmentMessage =
  "I am not confident enough to enrol you. Name the course you want to join.";

export const tutorTools = [
  "search_catalogue",
  "describe_course",
] as const satisfies readonly AgentToolName[];

export const advisorTools = [
  "latest_published_course",
  "search_catalogue",
  "suggest_next_course",
  "count_published_courses",
] as const satisfies readonly AgentToolName[];

export const enrolmentTools = [
  "enrol_in_course",
  "fetch_my_grades",
  "describe_course",
] as const satisfies readonly AgentToolName[];

export type AgentMemory = {
  messages: AgentMessage[];
  courseIds: string[];
  enrolled: AgentCourseRef | null;
  toolResults: unknown[];
};

export type ToolMemory = {
  name: string;
  payload: unknown;
  courseIds: string[];
  enrolled: AgentCourseRef | null;
};

export function specialistTools(agent: SpecialistName): readonly AgentToolName[] {
  if (agent === "tutor") return tutorTools;
  if (agent === "advisor") return advisorTools;
  return enrolmentTools;
}

export function createAgentMemory(messages: AgentMessage[]): AgentMemory {
  return { messages, courseIds: [], enrolled: null, toolResults: [] };
}

export function rememberTool(memory: AgentMemory, run: ToolMemory) {
  memory.toolResults.push({ name: run.name, result: run.payload });
  for (const courseId of run.courseIds) {
    if (!memory.courseIds.includes(courseId)) memory.courseIds.push(courseId);
  }
  if (run.enrolled) memory.enrolled = run.enrolled;
}

export function parseSupervisorRoute(
  value: unknown,
): { ok: true; agent: SpecialistName; confidence: number; task: string } | { ok: false } {
  const record = asRecord(value);
  if (!record) return { ok: false };
  const agent = enumValue(record["agent"], specialistNames);
  const confidence = confidenceValue(record["confidence"]);
  const task = requiredText(record, "task");
  if (!agent || confidence === null || !task) return { ok: false };
  return { ok: true, agent, confidence, task };
}

const categoryStopWords = new Set([
  "latest",
  "newest",
  "published",
  "course",
  "courses",
  "what",
  "which",
  "when",
  "where",
  "the",
  "for",
  "and",
  "with",
  "from",
  "into",
  "about",
  "this",
  "that",
  "your",
  "have",
  "does",
  "show",
  "please",
  "there",
]);

export function latestPublishedRequested(messages: AgentMessage[]) {
  const latestUser = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUser) return false;
  return (
    /\b(latest|newest)\b/i.test(latestUser.content) && /\bpublished\b/i.test(latestUser.content)
  );
}

export function routeAdvisorTool(name: string, messages: AgentMessage[]) {
  if (name === "search_catalogue" && latestPublishedRequested(messages)) {
    return "latest_published_course";
  }
  return name;
}

export function categoryNeedles(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !categoryStopWords.has(word));
}

export function matchLatestPublished<
  T extends { id: string; createdAt: string; categoryName: string | null },
>(courses: T[], categoryText: string) {
  const ordered = [...courses].sort((left, right) => {
    if (left.createdAt === right.createdAt) return left.id.localeCompare(right.id);
    return right.createdAt.localeCompare(left.createdAt);
  });
  const needles = categoryNeedles(categoryText);
  if (needles.length === 0) return ordered;
  return ordered.filter((course) => {
    const name = course.categoryName?.toLowerCase() ?? "";
    if (!name) return false;
    return needles.some((word) => name.includes(word) || word.includes(name));
  });
}

export function selectSpecialist(
  route: { agent: SpecialistName; confidence: number },
  messages: AgentMessage[],
): { kind: "refuse" } | { kind: "run"; agent: SpecialistName } {
  if (route.agent === "enrolment" && isLowConfidence(route.confidence)) return { kind: "refuse" };
  if (enrolRequested(messages)) return { kind: "run", agent: "enrolment" };
  if (latestPublishedRequested(messages)) return { kind: "run", agent: "advisor" };
  return { kind: "run", agent: route.agent };
}

export function supervisorSystemPrompt() {
  return [
    "You are the EduHub supervisor for one signed-in student.",
    "Choose one specialist. Do not call a tool and do not answer the student.",
    'Reply with JSON only: {"agent":"tutor|advisor|enrolment","confidence":0.0,"task":"..."}.',
    "confidence is a number from 0 to 1. tutor explains a lesson the student can see.",
    "advisor recommends a course, a learning path, how many published courses there are, or the latest published course.",
    "enrolment enrols the student or reads that student's grades.",
    "A direct request to enrol or join is enrolment.",
    untrustedDataRule,
  ].join(" ");
}

export function specialistSystemPrompt(agent: SpecialistName) {
  const shared = [
    "Use only the tool results in this conversation. Do not invent courses, lessons, grades, or enrolment.",
    "Reply with JSON only.",
    'An answer is {"type":"answer","text":"...","courses":[{"id":"...","title":"..."}]}.',
    'A tool call is {"type":"tool","name":"<tool>","arguments":{}}.',
    "Course ids in an answer must be ids returned by a tool in this conversation.",
    untrustedDataRule,
    trustedToolRule,
  ];
  if (agent === "tutor") {
    return [
      "You are the EduHub tutor for one signed-in student. Explain a lesson or what a course covers.",
      "Tools: search_catalogue {query}, describe_course {courseId}.",
      ...shared,
    ].join(" ");
  }
  if (agent === "advisor") {
    return [
      "You are the EduHub advisor for one signed-in student. Recommend a course or a learning path.",
      "Tools: latest_published_course {category}, search_catalogue {query}, suggest_next_course {}, count_published_courses {}.",
      "Use latest_published_course when the student asks for the latest or newest published course. Pass the category name when they name one. Do not use search_catalogue for that question.",
      "Use count_published_courses when the student asks how many courses there are. Report that count. Do not count search_catalogue matches.",
      ...shared,
    ].join(" ");
  }
  return [
    "You are the EduHub enrolment specialist for one signed-in student.",
    "Tools: enrol_in_course {courseId}, fetch_my_grades {}, describe_course {courseId}.",
    "Call enrol_in_course only when the student asks to enrol or join a course.",
    ...shared,
  ].join(" ");
}

export function supervisorUserPrompt(messages: AgentMessage[]) {
  return agentUserPrompt(messages, []);
}

export function specialistUserPrompt(memory: AgentMemory, task: string) {
  return `${wrapUntrusted("task", redactPii(task))}\n${agentUserPrompt(memory.messages, memory.toolResults)}`;
}
