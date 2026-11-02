import { withGeminiTimeout } from "./embeddings.ts";
import {
  failedAiMessage,
  invalidAiMessage,
  sanitizeAiDetail,
  type CompletionResult,
} from "./gemini.ts";

export const defaultOllamaLevelModel = "llama3.2";
export const ollamaChatTimeoutMs = 120_000;

export function ollamaChatUrl(host: string) {
  return `${host.replace(/\/$/, "")}/api/chat`;
}

export function ollamaChatBody(input: {
  model: string;
  system: string;
  user: string;
  temperature: number;
}) {
  return {
    model: input.model,
    stream: false,
    format: "json",
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    options: { temperature: input.temperature },
  };
}

export async function completeOllamaJson(
  input: { host: string; model: string; system: string; user: string; temperature?: number },
  fetchImpl: typeof fetch,
): Promise<CompletionResult> {
  const host = input.host.trim().replace(/\/$/, "");
  if (!host || !input.model.trim()) {
    return {
      ok: false,
      message: failedAiMessage,
      failure: "infrastructure",
      kind: "fatal",
      retryable: false,
      retryAfterMs: null,
    };
  }

  const fetchWithTimeout = withGeminiTimeout(fetchImpl, ollamaChatTimeoutMs);
  let response: Response;
  try {
    response = await fetchWithTimeout(ollamaChatUrl(host), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        ollamaChatBody({
          model: input.model.trim(),
          system: input.system,
          user: input.user,
          temperature: input.temperature ?? 0,
        }),
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    console.error(
      JSON.stringify({
        source: "ollama-chat",
        status: null,
        kind: "network",
        detail: sanitizeAiDetail(message),
      }),
    );
    return {
      ok: false,
      message: failedAiMessage,
      failure: "infrastructure",
      kind: "network",
      retryable: true,
      retryAfterMs: null,
    };
  }

  if (!response.ok) {
    const body = await response.text();
    const retryAfterMs = retryAfterHeaderMs(response.headers.get("retry-after"));
    const kind = ollamaFailureKind(response.status);
    console.error(
      JSON.stringify({
        source: "ollama-chat",
        status: response.status,
        kind,
        detail: sanitizeAiDetail(body).slice(0, 180),
      }),
    );
    return {
      ok: false,
      message: failedAiMessage,
      failure: "infrastructure",
      kind,
      retryable: kind === "rate_limit" || kind === "server",
      retryAfterMs,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: invalidAiMessage, failure: "invalid" };
  }

  if (ollamaErrorText(payload)) {
    console.error(
      JSON.stringify({
        source: "ollama-chat",
        status: response.status,
        kind: "fatal",
        detail: sanitizeAiDetail(ollamaErrorText(payload) ?? "").slice(0, 180),
      }),
    );
    return {
      ok: false,
      message: failedAiMessage,
      failure: "infrastructure",
      kind: "fatal",
      retryable: false,
      retryAfterMs: null,
    };
  }

  const content = ollamaMessageContent(payload);
  if (!content) return { ok: false, message: invalidAiMessage, failure: "invalid" };
  try {
    return { ok: true, value: JSON.parse(stripJsonFence(content)) as unknown };
  } catch {
    return { ok: false, message: invalidAiMessage, failure: "invalid" };
  }
}

function ollamaFailureKind(status: number) {
  if (status === 429) return "rate_limit" as const;
  if (status >= 500 && status <= 599) return "server" as const;
  return "fatal" as const;
}

function ollamaErrorText(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return "";
  return typeof payload.error === "string" ? payload.error.trim() : "";
}

function ollamaMessageContent(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("message" in payload)) return "";
  const message = payload.message;
  if (!message || typeof message !== "object" || !("content" in message)) return "";
  return typeof message.content === "string" ? message.content : "";
}

function retryAfterHeaderMs(header: string | null) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

function stripJsonFence(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}
