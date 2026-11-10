import {
  agentSystemPrompt,
  agentUserPrompt,
  enrolRequested,
  filterAnswerCourses,
  parseAgentMessages,
  parseAgentReply,
  assistantToolLimit,
  studentOnlyAgentMessage,
  unfinishedAgentMessage,
  type AgentCourseRef,
} from "./agent.ts";
import { runAgentTool, type AgentReader } from "./agent-tools.ts";
import { enforceAiRateLimit, type AiRateDb } from "./ai-rate-limit.ts";
import { authorizeTool, agentToolAllowlist } from "./guardrails.ts";
import { defaultOllamaHost, withGeminiTimeout } from "./embeddings.ts";
import { completeJson, invalidAiMessage, missingAiMessage } from "./gemini.ts";
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

  const allowedIds = new Set<string>();
  const toolResults: unknown[] = [];
  let enrolled: AgentCourseRef | null = null;
  const fetchImpl = withGeminiTimeout(deps.fetchImpl, agentChatTimeoutMs);

  for (let round = 0; round <= assistantToolLimit; round += 1) {
    const completion = await completeJson(
      {
        apiKey: deps.geminiKey,
        system: agentSystemPrompt(),
        user: agentUserPrompt(parsed.messages, toolResults),
      },
      fetchImpl,
    );
    if (!completion.ok) return jsonResponse({ ok: false, message: completion.message });

    const reply = parseAgentReply(completion.value);
    if (!reply.ok) return jsonResponse({ ok: false, message: reply.message });
    if (reply.type === "answer") {
      return jsonResponse({
        ok: true,
        text: reply.text,
        courses: filterAnswerCourses(reply.courses, allowedIds),
        enrolled,
      });
    }
    if (!authorizeTool(reply.name, agentToolAllowlist)) {
      return jsonResponse({ ok: false, message: invalidAiMessage });
    }
    if (round >= assistantToolLimit) {
      return jsonResponse({ ok: false, message: unfinishedAgentMessage });
    }

    const tool = await runAgentTool(reply.name, reply.arguments, {
      userId: user.userId,
      enrolRequested: enrolRequested(parsed.messages),
      apiKey: deps.geminiKey,
      ollamaHost: deps.ollamaHost?.trim() || defaultOllamaHost,
      fetchImpl,
      reader: deps.reader,
    });
    if (!tool.ok) return jsonResponse({ ok: false, message: tool.message });
    if (reply.name === "enrol_in_course" && tool.run.enrolled && deps.syncEnrolment) {
      try {
        await deps.syncEnrolment(user.userId, tool.run.enrolled.id);
      } catch {
        // The enrolment is already saved.
      }
    }
    for (const courseId of tool.run.courseIds) allowedIds.add(courseId);
    if (tool.run.enrolled) enrolled = tool.run.enrolled;
    toolResults.push({ name: tool.run.name, result: tool.run.payload });
  }

  return jsonResponse({ ok: false, message: unfinishedAgentMessage });
}
