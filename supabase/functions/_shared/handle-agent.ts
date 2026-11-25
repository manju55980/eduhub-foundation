import {
  assistantModelContent,
  enrolRequested,
  filterAnswerCourses,
  parseAgentMessages,
  parseAgentReply,
  assistantContentLimit,
  assistantToolLimit,
  enrolledSentence,
  questionRequiredMessage,
  studentOnlyAgentMessage,
  unfinishedAgentMessage,
  type AgentCourseRef,
  type AgentMessage,
} from "./agent.ts";
import {
  openThreadTurn,
  persistThreadTurn,
  readThreadId,
  readTurnContent,
  threadMissingMessage,
  type AiThreadStore,
} from "./ai-thread.ts";
import { runAgentTool, type AgentReader } from "./agent-tools.ts";
import {
  createAgentMemory,
  lowConfidenceEnrolmentMessage,
  parseSupervisorRoute,
  rememberTool,
  routeAdvisorTool,
  selectSpecialist,
  specialistSystemPrompt,
  specialistTools,
  specialistUserPrompt,
  supervisorSystemPrompt,
  supervisorUserPrompt,
} from "./agent-team.ts";
import { enforceAiRateLimit, type AiRateDb } from "./ai-rate-limit.ts";
import { authorizeTool } from "./guardrails.ts";
import { defaultOllamaHost, withGeminiTimeout } from "./embeddings.ts";
import { completeChat, geminiFallbackModel, invalidAiMessage, missingAiMessage } from "./gemini.ts";
import { emptyResponse, jsonResponse } from "./http.ts";
import { resolveUserClient } from "./user-client.ts";

export const agentChatTimeoutMs = 45_000;

export async function handleAgent(
  request: Request,
  deps: {
    supabaseUrl: string | undefined;
    publishableKey: string | undefined;
    geminiKey: string | undefined;
    ollamaHost?: string;
    authorization: string | null;
    reader: AgentReader;
    fetchImpl: typeof fetch;
    rateLimit?: AiRateDb;
    threads?: AiThreadStore;
    syncEnrolment?: (userId: string, courseId: string) => Promise<void>;
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

  const threadRef = readThreadId(body);
  if (!threadRef.ok) return jsonResponse({ ok: false, message: threadRef.message });
  const openThreadId = threadRef.threadId;

  let legacy: AgentMessage[] | null = null;
  let userContent = "";
  if (openThreadId) {
    const content = readTurnContent(body, questionRequiredMessage);
    if (!content.ok) return jsonResponse({ ok: false, message: content.message });
    userContent = content.content;
  } else {
    const parsed = parseAgentMessages(body);
    if (!parsed.ok) return jsonResponse({ ok: false, message: parsed.message });
    legacy = parsed.messages;
  }

  const user = await deps.reader.userId();
  if (!user.ok) return jsonResponse({ ok: false, message: user.message }, 401);

  const role = await deps.reader.role(user.userId);
  if (!role.ok) return jsonResponse({ ok: false, message: role.message });
  if (role.role !== "student") {
    return jsonResponse({ ok: false, message: studentOnlyAgentMessage }, 403);
  }

  if (!deps.geminiKey?.trim()) return jsonResponse({ ok: false, message: missingAiMessage });

  let messages: AgentMessage[] = legacy ?? [];
  let active = false;
  if (openThreadId) {
    const turn = await openThreadTurn(deps.threads, {
      threadId: openThreadId,
      surface: "assistant",
      courseId: null,
      slots: 2,
    });
    if (!turn.ok) return jsonResponse({ ok: false, message: turn.message }, turn.status);
    if (!turn.active) return jsonResponse({ ok: false, message: threadMissingMessage }, 500);
    active = true;
    messages = [
      ...turn.messages.map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: userContent },
    ];
  }

  const allowance = await enforceAiRateLimit(deps.rateLimit, "ai-agent");
  if (!allowance.ok) {
    return jsonResponse({ ok: false, message: allowance.message }, allowance.status);
  }

  async function finish(result: {
    text: string;
    courses: AgentCourseRef[];
    enrolled: AgentCourseRef | null;
  }) {
    const visible = result.enrolled ? `${result.text}\n\n${enrolledSentence}` : result.text;
    const saved = await persistThreadTurn(deps.threads, active, {
      threadId: openThreadId ?? "",
      surface: "assistant",
      courseId: null,
      slots: 2,
      userContent,
      assistantContent: assistantModelContent(visible, result.courses),
      payload: {
        text: visible.slice(0, assistantContentLimit),
        courses: result.courses,
        enrolled: result.enrolled,
      },
    });
    if (!saved.ok) return jsonResponse({ ok: false, message: saved.message }, saved.status);
    return jsonResponse({ ok: true, ...result });
  }

  const fetchImpl = withGeminiTimeout(deps.fetchImpl, agentChatTimeoutMs);
  const routed = await completeChat(
    {
      apiKey: deps.geminiKey,
      system: supervisorSystemPrompt(),
      user: supervisorUserPrompt(messages),
    },
    fetchImpl,
    { fallbackModel: geminiFallbackModel },
  );
  if (!routed.ok) return jsonResponse({ ok: false, message: routed.message });
  const route = parseSupervisorRoute(routed.value);
  if (!route.ok) return jsonResponse({ ok: false, message: invalidAiMessage });
  const selected = selectSpecialist(route, messages);
  if (selected.kind === "refuse") {
    return finish({ text: lowConfidenceEnrolmentMessage, courses: [], enrolled: null });
  }

  const allowlist = specialistTools(selected.agent);
  const memory = createAgentMemory(messages);

  for (let round = 0; round <= assistantToolLimit; round += 1) {
    const completion = await completeChat(
      {
        apiKey: deps.geminiKey,
        system: specialistSystemPrompt(selected.agent),
        user: specialistUserPrompt(memory, route.task),
      },
      fetchImpl,
      { fallbackModel: geminiFallbackModel },
    );
    if (!completion.ok) return jsonResponse({ ok: false, message: completion.message });

    const reply = parseAgentReply(completion.value);
    if (!reply.ok) return jsonResponse({ ok: false, message: reply.message });
    if (reply.type === "answer") {
      return finish({
        text: reply.text,
        courses: filterAnswerCourses(reply.courses, new Set(memory.courseIds)),
        enrolled: memory.enrolled,
      });
    }
    const toolName =
      selected.agent === "advisor" ? routeAdvisorTool(reply.name, messages) : reply.name;
    if (!authorizeTool(toolName, allowlist)) {
      return jsonResponse({ ok: false, message: invalidAiMessage });
    }
    if (round >= assistantToolLimit) {
      return jsonResponse({ ok: false, message: unfinishedAgentMessage });
    }

    const latestUser = [...messages].reverse().find((message) => message.role === "user");
    const tool = await runAgentTool(toolName, reply.arguments, {
      userId: user.userId,
      enrolRequested: enrolRequested(messages),
      apiKey: deps.geminiKey,
      ollamaHost: deps.ollamaHost?.trim() || defaultOllamaHost,
      fetchImpl,
      reader: deps.reader,
      catalogueText: latestUser?.content ?? "",
    });
    if (!tool.ok) return jsonResponse({ ok: false, message: tool.message });
    if (reply.name === "enrol_in_course" && tool.run.enrolled && deps.syncEnrolment) {
      try {
        await deps.syncEnrolment(user.userId, tool.run.enrolled.id);
      } catch {
        // The enrolment is already saved.
      }
    }
    rememberTool(memory, tool.run);
  }

  return jsonResponse({ ok: false, message: unfinishedAgentMessage });
}
