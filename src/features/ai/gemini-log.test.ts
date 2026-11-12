import { describe, expect, it, vi } from "vitest";

import {
  completeChat,
  completeJson,
  geminiFallbackModel,
  geminiGenerateUrl,
  geminiModel,
  sanitizeAiDetail,
  type AiFailureLog,
} from "../../../supabase/functions/_shared/gemini.ts";

const apiKey = "AIzaSyTestKeyValue1234567890";
const lessonText = "Photosynthesis happens in the leaves of this lesson.";

function completionInput() {
  return {
    apiKey,
    system: "Reply with JSON only.",
    user: `Lesson:\n${lessonText}\nQuestion: How do leaves eat?`,
  };
}

function geminiError(status: number, errorStatus: string, message: string) {
  return new Response(JSON.stringify({ error: { code: status, message, status: errorStatus } }), {
    status,
  });
}

function geminiText(value: unknown) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
  };
}

describe("Gemini failure logs", () => {
  it("calls the free-tier model without putting the key in the URL", async () => {
    let requestUrl = "";
    let apiKeyHeader = "";
    await completeJson(completionInput(), async (input, init) => {
      requestUrl = String(input);
      apiKeyHeader = new Headers(init?.headers).get("x-goog-api-key") ?? "";
      return new Response(JSON.stringify(geminiText({ explanation: "Because." })), { status: 200 });
    });

    expect(requestUrl).toBe(geminiGenerateUrl(geminiModel));
    expect(requestUrl).not.toContain(apiKey);
    expect(apiKeyHeader).toBe(apiKey);
    expect(geminiModel).toBe("gemini-3.5-flash-lite");
  });

  it("logs the HTTP status and sanitized Gemini error without the key or lesson text", async () => {
    const logs: AiFailureLog[] = [];
    const result = await completeJson(
      completionInput(),
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 401,
              message: `API key not valid. ${apiKey}. Lesson echo: ${lessonText}`,
              status: "UNAUTHENTICATED",
            },
          }),
          { status: 401 },
        ),
      (entry) => logs.push(entry),
    );

    expect(result).toEqual({ ok: false, message: "The AI request failed." });
    expect(logs).toEqual([
      {
        status: 401,
        errorType: "UNAUTHENTICATED",
        errorCode: "401",
        detail: "API key not valid. [redacted]. Lesson echo: [redacted]",
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain(apiKey);
    expect(JSON.stringify(logs)).not.toContain(lessonText);
    expect(JSON.stringify(logs)).not.toContain("x-goog-api-key");
  });

  it("logs a network failure without a bearer token or lesson text", async () => {
    const logs: AiFailureLog[] = [];
    const result = await completeJson(
      completionInput(),
      async () => {
        throw new Error(`connect failed Bearer ${apiKey}.jwt.sig ${lessonText}`);
      },
      (entry) => logs.push(entry),
    );

    expect(result).toEqual({ ok: false, message: "The AI request failed." });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: null, errorType: "network", errorCode: null });
    expect(logs[0]?.detail).toContain("connect failed");
    expect(logs[0]?.detail).not.toContain(apiKey);
    expect(logs[0]?.detail).not.toContain(lessonText);
    expect(logs[0]?.detail).not.toContain("jwt.sig");
  });

  it("does not log a successful completion", async () => {
    const log = vi.fn();
    const result = await completeJson(
      completionInput(),
      async () =>
        new Response(JSON.stringify(geminiText({ explanation: "Because." })), { status: 200 }),
      log,
    );

    expect(result.ok).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it("retries a busy model once and then calls the fallback model", async () => {
    const urls: string[] = [];
    const result = await completeChat(
      completionInput(),
      async (input) => {
        urls.push(String(input));
        if (urls.length < 3) return geminiError(503, "UNAVAILABLE", "high demand");
        return new Response(JSON.stringify(geminiText({ explanation: "Because." })), {
          status: 200,
        });
      },
      { fallbackModel: geminiFallbackModel, sleep: async () => undefined, log: () => undefined },
    );

    expect(result.ok).toBe(true);
    expect(urls).toEqual([
      geminiGenerateUrl(geminiModel),
      geminiGenerateUrl(geminiModel),
      geminiGenerateUrl(geminiFallbackModel),
    ]);
  });

  it("does not retry a rejected key", async () => {
    let calls = 0;
    const result = await completeChat(
      completionInput(),
      async () => {
        calls += 1;
        return geminiError(401, "UNAUTHENTICATED", "API key not valid.");
      },
      {
        fallbackModel: geminiFallbackModel,
        sleep: async () => {
          throw new Error("sleep");
        },
        log: () => undefined,
      },
    );

    expect(result).toEqual({ ok: false, message: "The AI request failed." });
    expect(calls).toBe(1);
  });

  it("redacts a raw response body that is only the API key", () => {
    expect(sanitizeAiDetail(apiKey, [apiKey])).toBe("[redacted]");
    expect(sanitizeAiDetail(`Bearer ${"eyJabc.def.ghi"}`, [])).toBe("Bearer [redacted]");
  });
});
