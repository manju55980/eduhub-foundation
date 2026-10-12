import { describe, expect, it, vi } from "vitest";

import {
  completeJson,
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

    expect(requestUrl).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    );
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

  it("redacts a raw response body that is only the API key", () => {
    expect(sanitizeAiDetail(apiKey, [apiKey])).toBe("[redacted]");
    expect(sanitizeAiDetail(`Bearer ${"eyJabc.def.ghi"}`, [])).toBe("Bearer [redacted]");
  });
});
