import {
  enrolRequested,
  filterAnswerCourses,
  parseAgentMessages,
  parseAgentReply,
  assistantToolLimit,
  studentOnlyAgentMessage,
  unfinishedAgentMessage,
} from "./agent.ts";
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

  const parsed = parseAgentMessages(body);
  if (!parsed.ok) return jsonResponse({ ok: false, message: parsed.message });

  const user = await deps.reader.userId();
  if (!user.ok) return jsonResponse({ ok: false, message: user.message }, 401);

  const role = await deps.reader.role(user.userId);
  if (!role.ok) return jsonResponse({ ok: false, message: role.message });
  if (role.role !== "student") {
    return jsonResponse({ ok: false, message: studentOnlyAgentMessage }, 403);
  }

  if (!deps.geminiKey?.trim()) return jsonResponse({ ok: false, message: missingAiMessage });

  const allowance = await enforceAiRateLimit(deps.rateLimit, "ai-agent");
  if (!allowance.ok) {
    return jsonResponse({ ok: false, message: allowance.message }, allowance.status);
  }

  const fetchImpl = withGeminiTimeout(deps.fetchImpl, agentChatTimeoutMs);
  const routed = await completeChat(
    {
      apiKey: deps.geminiKey,
      system: supervisorSystemPrompt(),
      user: supervisorUserPrompt(parsed.messages),
    },
    fetchImpl,
    { fallbackModel: geminiFallbackModel },
  );
  if (!routed.ok) return jsonResponse({ ok: false, message: routed.message });
  const route = parseSupervisorRoute(routed.value);
  if (!route.ok) return jsonResponse({ ok: false, message: invalidAiMessage });
  const selected = selectSpecialist(route, parsed.messages);
  if (selected.kind === "refuse") {
    return jsonResponse({
      ok: true,
      text: lowConfidenceEnrolmentMessage,
      courses: [],
      enrolled: null,
    });
  }

  const allowlist = specialistTools(selected.agent);
  const memory = createAgentMemory(parsed.messages);

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
      return jsonResponse({
        ok: true,
        text: reply.text,
        courses: filterAnswerCourses(reply.courses, new Set(memory.courseIds)),
        enrolled: memory.enrolled,
      });
    }
    const toolName =
      selected.agent === "advisor" ? routeAdvisorTool(reply.name, parsed.messages) : reply.name;
    if (!authorizeTool(toolName, allowlist)) {
      return jsonResponse({ ok: false, message: invalidAiMessage });
    }
    if (round >= assistantToolLimit) {
      return jsonResponse({ ok: false, message: unfinishedAgentMessage });
    }

    const latestUser = [...parsed.messages].reverse().find((message) => message.role === "user");
    const tool = await runAgentTool(toolName, reply.arguments, {
      userId: user.userId,
      enrolRequested: enrolRequested(parsed.messages),
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
