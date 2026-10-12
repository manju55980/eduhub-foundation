export const geminiModel = "gemini-3.5-flash-lite";
export const missingAiMessage = "AI is not configured.";
export const failedAiMessage = "The AI request failed.";
export const invalidAiMessage = "The AI response was not valid.";

export type AiFailureLog = {
  status: number | null;
  errorType: string | null;
  errorCode: string | null;
  detail: string;
};

const detailLimit = 180;
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

export function sanitizeAiDetail(value: string, redactions: string[] = []) {
  let detail = value;
  for (const phrase of redactionPhrases(redactions)) {
    detail = detail.split(phrase).join("[redacted]");
  }
  detail = detail
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted]");
  return detail.replace(/\s+/g, " ").trim().slice(0, detailLimit);
}

function redactionPhrases(values: string[]) {
  const phrases = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length >= 8) phrases.add(trimmed);
    for (const line of value.split("\n")) {
      const phrase = line.trim();
      if (phrase.length >= 12) phrases.add(phrase);
    }
  }
  return [...phrases].sort((left, right) => right.length - left.length);
}

export function logAiFailure(entry: AiFailureLog) {
  console.error(
    JSON.stringify({
      source: "gemini",
      status: entry.status,
      errorType: entry.errorType,
      errorCode: entry.errorCode,
      detail: entry.detail,
    }),
  );
}

export async function completeJson(
  input: { apiKey: string | undefined; system: string; user: string },
  fetchImpl: typeof fetch,
  log: (entry: AiFailureLog) => void = logAiFailure,
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) return { ok: false, message: missingAiMessage };
  const redactions = [apiKey, input.system, input.user];

  let response: Response;
  try {
    response = await fetchImpl(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.user }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    log({
      status: null,
      errorType: "network",
      errorCode: null,
      detail: sanitizeAiDetail(message, redactions),
    });
    return { ok: false, message: failedAiMessage };
  }

  if (!response.ok) {
    log(await geminiFailure(response, redactions));
    return { ok: false, message: failedAiMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: invalidAiMessage };
  }

  const content = messageContent(payload);
  if (!content) return { ok: false, message: invalidAiMessage };

  try {
    return { ok: true, value: JSON.parse(stripJsonFence(content)) as unknown };
  } catch {
    return { ok: false, message: invalidAiMessage };
  }
}

function stripJsonFence(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

async function geminiFailure(response: Response, redactions: string[]): Promise<AiFailureLog> {
  let errorType: string | null = null;
  let errorCode: string | null = null;
  let detail = "";
  let raw = "";
  try {
    raw = (await response.text()).slice(0, 2000);
    const parsed: unknown = JSON.parse(raw);
    const error = errorObject(parsed);
    if (error) {
      errorType = shortCode(error, "status") ?? shortCode(error, "type");
      errorCode = errorCodeValue(error);
      detail = typeof error["message"] === "string" ? error["message"] : "";
    } else {
      detail = raw;
    }
  } catch {
    detail = raw;
  }
  return {
    status: response.status,
    errorType,
    errorCode,
    detail: sanitizeAiDetail(detail, redactions),
  };
}

function errorObject(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  const error = value.error;
  if (!error || typeof error !== "object") return null;
  return error as Record<string, unknown>;
}

function errorCodeValue(error: Record<string, unknown>) {
  const value = error["code"];
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return shortCode(error, "code");
}

function shortCode(error: Record<string, unknown>, key: string) {
  const value = error[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80 || /sk-|AIza|bearer\s|sb_secret_/i.test(trimmed)) return null;
  return trimmed;
}

function messageContent(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("candidates" in payload)) return "";
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const first: unknown = candidates[0];
  if (!first || typeof first !== "object" || !("content" in first)) return "";
  const content = first.content;
  if (!content || typeof content !== "object" || !("parts" in content)) return "";
  const parts = content.parts;
  if (!Array.isArray(parts)) return "";
  const texts: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    if ("thought" in part && part.thought === true) continue;
    if ("text" in part && typeof part.text === "string" && part.text.trim()) texts.push(part.text);
  }
  return texts.join("");
}
