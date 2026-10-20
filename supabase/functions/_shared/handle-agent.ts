import {
  agentSystemPrompt,
  agentUserPrompt,
  enrolRequested,
  filterAnswerCourses,
  isAgentTool,
  parseAgentMessages,
  parseAgentReply,
  assistantToolLimit,
  studentOnlyAgentMessage,
  unfinishedAgentMessage,
  type AgentCourseRef,
} from "./agent.ts";
import { runAgentTool, type AgentReader } from "./agent-tools.ts";
import { embeddingTimeoutMs, withGeminiTimeout } from "./embeddings.ts";
import { completeJson, invalidAiMessage, missingAiMessage } from "./gemini.ts";
import { emptyResponse, jsonResponse } from "./http.ts";
import { resolveUserClient } from "./user-client.ts";

export async function handleAgent(
  request: Request,
  deps: {
    supabaseUrl: string | undefined;
    publishableKey: string | undefined;
    geminiKey: string | undefined;
    authorization: string | null;
    reader: AgentReader;
    fetchImpl: typeof fetch;
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

  const allowedIds = new Set<string>();
  const toolResults: unknown[] = [];
  let enrolled: AgentCourseRef | null = null;
  const fetchImpl = withGeminiTimeout(deps.fetchImpl, embeddingTimeoutMs);

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
    if (!isAgentTool(reply.name)) {
      return jsonResponse({ ok: false, message: invalidAiMessage });
    }
    if (round >= assistantToolLimit) {
      return jsonResponse({ ok: false, message: unfinishedAgentMessage });
    }

    const tool = await runAgentTool(reply.name, reply.arguments, {
      userId: user.userId,
      enrolRequested: enrolRequested(parsed.messages),
      apiKey: deps.geminiKey,
      fetchImpl,
      reader: deps.reader,
    });
    if (!tool.ok) return jsonResponse({ ok: false, message: tool.message });
    for (const courseId of tool.run.courseIds) allowedIds.add(courseId);
    if (tool.run.enrolled) enrolled = tool.run.enrolled;
    toolResults.push({ name: tool.run.name, result: tool.run.payload });
  }

  return jsonResponse({ ok: false, message: unfinishedAgentMessage });
}
