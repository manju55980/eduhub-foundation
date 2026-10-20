import { failedAiMessage, invalidAiMessage, missingAiMessage, sanitizeAiDetail } from "./gemini.ts";

export const embeddingModel = "gemini-embedding-001";
export const embeddingDimensions = 768;
export const embeddingTimeoutMs = 20_000;
export const embeddingQuotaMessage = "The embedding quota is exhausted.";
export const embeddingRetryLimit = 6;
export const embeddingBackoffCapMs = 30_000;

export type EmbedFailureKind = "quota" | "rate_limit" | "server" | "fatal";

export type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:batchEmbedContents`;

export function l2Normalize(
  values: number[],
): { ok: true; values: number[] } | { ok: false; message: string } {
  if (values.length !== embeddingDimensions) return { ok: false, message: invalidAiMessage };
  let sum = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) return { ok: false, message: invalidAiMessage };
    sum += value * value;
  }
  const norm = Math.sqrt(sum);
  if (norm === 0) return { ok: false, message: invalidAiMessage };
  return { ok: true, values: values.map((value) => value / norm) };
}

export function embeddingLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

export function embedRequestBody(texts: string[], taskType: EmbeddingTask) {
  return {
    requests: texts.map((text) => ({
      model: `models/${embeddingModel}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: embeddingDimensions,
    })),
  };
}

export function parseEmbedResponse(
  payload: unknown,
  expected: number,
): { ok: true; vectors: number[][] } | { ok: false; message: string } {
  if (!payload || typeof payload !== "object" || !("embeddings" in payload)) {
    return { ok: false, message: invalidAiMessage };
  }
  const embeddings = payload.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== expected) {
    return { ok: false, message: invalidAiMessage };
  }
  const vectors: number[][] = [];
  for (const embedding of embeddings) {
    if (!embedding || typeof embedding !== "object" || !("values" in embedding)) {
      return { ok: false, message: invalidAiMessage };
    }
    const values = embedding.values;
    if (!Array.isArray(values) || values.some((value) => typeof value !== "number")) {
      return { ok: false, message: invalidAiMessage };
    }
    const normalized = l2Normalize(values);
    if (!normalized.ok) return normalized;
    vectors.push(normalized.values);
  }
  return { ok: true, vectors };
}

export function withGeminiTimeout(
  fetchImpl: typeof fetch,
  timeoutMs = embeddingTimeoutMs,
): typeof fetch {
  return async (input, init) => {
    if (init?.signal) return fetchImpl(input, init);
    const timeout = startTimeout(timeoutMs);
    try {
      return await fetchImpl(input, { ...init, signal: timeout.signal });
    } finally {
      timeout.cancel();
    }
  };
}

function startTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === "object" && "unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

export function classifyEmbedFailure(status: number, body: string) {
  const retryAfterMs = retryDelayFromBody(body);
  const text = body.toLowerCase();
  if (
    status === 429 &&
    text.includes("quota") &&
    (text.includes("billing") || text.includes("plan"))
  ) {
    return { kind: "quota" as const, retryAfterMs };
  }
  if (status === 429) return { kind: "rate_limit" as const, retryAfterMs };
  if (status >= 500 && status <= 599) return { kind: "server" as const, retryAfterMs };
  return { kind: "fatal" as const, retryAfterMs: null };
}

export function retryAfterHeaderMs(header: string | null, now = Date.now()) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

export function embedBackoffMs(attempt: number, baseDelayMs: number, retryAfterMs: number | null) {
  const exponential = Math.min(Math.max(baseDelayMs, 500) * 2 ** attempt, embeddingBackoffCapMs);
  const hinted =
    retryAfterMs === null ? 0 : Math.min(Math.max(retryAfterMs, 0), embeddingBackoffCapMs);
  return Math.max(exponential, hinted);
}

export function embedFailureMessage(kind: EmbedFailureKind) {
  return kind === "quota" ? embeddingQuotaMessage : failedAiMessage;
}

export async function embedTexts(
  options: {
    apiKey: string | undefined;
    texts: string[];
    taskType: EmbeddingTask;
  },
  fetchImpl: typeof fetch,
): Promise<
  | { ok: true; vectors: number[][] }
  | { ok: false; message: string; kind: EmbedFailureKind; retryAfterMs: number | null }
> {
  const apiKey = options.apiKey?.trim() ?? "";
  if (!apiKey) return { ok: false, message: missingAiMessage, kind: "fatal", retryAfterMs: null };
  if (options.texts.length === 0) return { ok: true, vectors: [] };

  const timeout = startTimeout(embeddingTimeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(embedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(embedRequestBody(options.texts, options.taskType)),
      signal: timeout.signal,
    });
  } catch {
    return { ok: false, message: failedAiMessage, kind: "fatal", retryAfterMs: null };
  } finally {
    timeout.cancel();
  }

  if (!response.ok) {
    const body = await response.text();
    const failure = classifyEmbedFailure(response.status, body);
    const headerDelay = retryAfterHeaderMs(response.headers.get("retry-after"));
    const retryAfterMs =
      headerDelay === null
        ? failure.retryAfterMs
        : Math.max(headerDelay, failure.retryAfterMs ?? 0);
    console.error(
      JSON.stringify({
        source: "gemini-embed",
        status: response.status,
        kind: failure.kind,
        detail: sanitizeAiDetail(body, [apiKey]),
      }),
    );
    return {
      ok: false,
      message: embedFailureMessage(failure.kind),
      kind: failure.kind,
      retryAfterMs,
    };
  }

  try {
    return parseEmbedResponse(await response.json(), options.texts.length);
  } catch {
    return { ok: false, message: invalidAiMessage, kind: "fatal", retryAfterMs: null };
  }
}

export async function embedTextsWithRetry(
  options: {
    apiKey: string | undefined;
    texts: string[];
    taskType: EmbeddingTask;
    maxAttempts: number;
    baseDelayMs: number;
    sleep: (ms: number) => Promise<void>;
  },
  fetchImpl: typeof fetch,
) {
  const maxAttempts = clampInteger(options.maxAttempts, 1, embeddingRetryLimit, 1);
  let latest: Awaited<ReturnType<typeof embedTexts>> = {
    ok: false,
    message: failedAiMessage,
    kind: "fatal",
    retryAfterMs: null,
  };
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    latest = await embedTexts(options, fetchImpl);
    if (latest.ok) return latest;
    const retryable = latest.kind === "rate_limit" || latest.kind === "server";
    if (!retryable || attempt + 1 >= maxAttempts) return latest;
    await options.sleep(embedBackoffMs(attempt, options.baseDelayMs, latest.retryAfterMs));
  }
  return latest;
}

function retryDelayFromBody(body: string) {
  const match = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)(ms|s)"/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return match[2]?.toLowerCase() === "ms" ? amount : amount * 1000;
}

function clampInteger(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
