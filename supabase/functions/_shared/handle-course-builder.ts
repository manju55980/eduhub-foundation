import {
  builderAccess,
  builderPrompt,
  parseBuilderRequest,
  parseCoursePreview,
} from "./course-preview.ts";
import { completeJson } from "./gemini.ts";
import { emptyResponse, jsonResponse } from "./http.ts";
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
    authorization: string | null;
    reader: RoleReader;
    fetchImpl: typeof fetch;
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

  const prompt = builderPrompt(parsed.brief, parsed.level);
  const completion = await completeJson(
    { apiKey: deps.geminiKey, system: prompt.system, user: prompt.user },
    deps.fetchImpl,
  );
  if (!completion.ok) return jsonResponse({ ok: false, message: completion.message });

  const preview = parseCoursePreview(completion.value);
  if (!preview.ok) return jsonResponse({ ok: false, message: preview.message });

  return jsonResponse({ ok: true, preview: preview.preview });
}
