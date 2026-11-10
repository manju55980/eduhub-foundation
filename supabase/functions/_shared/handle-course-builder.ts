import {
  builderAccess,
  builderPrompt,
  parseBuilderRequest,
  parseCoursePreview,
} from "./course-preview.ts";
import { enforceAiRateLimit, type AiRateDb } from "./ai-rate-limit.ts";
import { completeJson, invalidAiMessage, missingAiMessage } from "./gemini.ts";
import { authorizeTool, isToolShaped, noToolAllowlist, toolName } from "./guardrails.ts";
import { emptyResponse, jsonResponse } from "./http.ts";
import { learningVideoQuery, searchLearningVideos } from "./learning-videos.ts";
import { resolveUserClient } from "./user-client.ts";

export type RoleReader = {
  userId: () => Promise<{ ok: true; userId: string } | { ok: false; message: string }>;
  role: (
    userId: string,
  ) => Promise<{ ok: true; role: string | null } | { ok: false; message: string }>;
};

export async function handleCourseBuilder(
  request: Request,
  deps: {
    supabaseUrl: string | undefined;
    publishableKey: string | undefined;
    geminiKey: string | undefined;
    youtubeKey?: string;
    authorization: string | null;
    reader: RoleReader;
    fetchImpl: typeof fetch;
    rateLimit?: AiRateDb;
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

  const parsed = parseBuilderRequest(body);
  if (!parsed.ok) return jsonResponse({ ok: false, message: parsed.message });

  const user = await deps.reader.userId();
  if (!user.ok) return jsonResponse({ ok: false, message: user.message }, 401);

  const role = await deps.reader.role(user.userId);
  if (!role.ok) return jsonResponse({ ok: false, message: role.message });

  const access = builderAccess(role.role);
  if (!access.ok) return jsonResponse({ ok: false, message: access.message }, 403);

  if (!deps.geminiKey?.trim()) return jsonResponse({ ok: false, message: missingAiMessage });

  const allowance = await enforceAiRateLimit(deps.rateLimit, "ai-course-builder");
  if (!allowance.ok) {
    return jsonResponse({ ok: false, message: allowance.message }, allowance.status);
  }

  const prompt = builderPrompt(parsed);
  const completion = await completeJson(
    { apiKey: deps.geminiKey, system: prompt.system, user: prompt.user },
    deps.fetchImpl,
  );
  if (!completion.ok) return jsonResponse({ ok: false, message: completion.message });
  if (
    isToolShaped(completion.value) &&
    !authorizeTool(toolName(completion.value), noToolAllowlist)
  ) {
    return jsonResponse({ ok: false, message: invalidAiMessage });
  }

  const preview = parseCoursePreview(completion.value, {
    lessons: parsed.lessonCount,
    assignments: parsed.assignmentCount,
  });
  if (!preview.ok) return jsonResponse({ ok: false, message: preview.message });

  const videos = await searchLearningVideos(
    {
      apiKey: deps.youtubeKey,
      query: learningVideoQuery(preview.preview.title, parsed.resources),
      limit: parsed.lessonCount,
    },
    deps.fetchImpl,
  );

  return jsonResponse({
    ok: true,
    preview: preview.preview,
    videos: videos.ok ? videos.videos : [],
    videoMessage: videos.message,
  });
}
