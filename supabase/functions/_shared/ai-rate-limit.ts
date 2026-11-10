import { failedAiMessage } from "./gemini.ts";

export const aiFeatures = [
  "ai-study",
  "ai-agent",
  "ai-course-builder",
  "ai-course-review",
] as const;

export type AiFeature = (typeof aiFeatures)[number];

export const aiRateLimitedMessage = "Too many AI requests. Try again later.";

export type AiRateDb = {
  rpc: (
    fn: "consume_ai_request",
    args: { requested_feature: AiFeature },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function consumeAiRequest(db: AiRateDb, feature: AiFeature) {
  const { data, error } = await db.rpc("consume_ai_request", { requested_feature: feature });
  if (error || typeof data !== "boolean") {
    return { ok: false as const, status: 500 as const, message: failedAiMessage };
  }
  if (!data) {
    return { ok: false as const, status: 429 as const, message: aiRateLimitedMessage };
  }
  return { ok: true as const };
}

export async function enforceAiRateLimit(db: AiRateDb | undefined, feature: AiFeature) {
  if (!db) return { ok: true as const };
  return consumeAiRequest(db, feature);
}

export function bindAiRateLimit(client: {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}): AiRateDb {
  return {
    async rpc(fn, args) {
      const { data, error } = await client.rpc(fn, args);
      return { data, error };
    },
  };
}
