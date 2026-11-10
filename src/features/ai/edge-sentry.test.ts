import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { logAiFailure } from "../../../supabase/functions/_shared/gemini.ts";
import { searchLearningVideos } from "../../../supabase/functions/_shared/learning-videos.ts";
import {
  sanitizeEdgeSentryEvent,
  settleEdgeReports,
  type EdgeSentryEvent,
} from "../../../supabase/functions/_shared/sentry.ts";

const dsn = "https://public@example.ingest.sentry.io/1";
const apiKey = "AIzaSyTestKeyValue1234567890";
const lesson = "Photosynthesis happens in the leaves of this lesson.";
const shared = join(dirname(fileURLToPath(import.meta.url)), "../../../supabase/functions/_shared");

type DenoEnv = { env: { get: (name: string) => string | undefined } };

function fakeSdk() {
  return {
    initWithoutDefaultIntegrations: vi.fn(),
    captureException: vi.fn(),
    flush: vi.fn(async () => true),
    linkedErrorsIntegration: vi.fn(() => ({ name: "LinkedErrors" })),
    dedupeIntegration: vi.fn(() => ({ name: "Dedupe" })),
  };
}

async function loadReporter() {
  vi.resetModules();
  return import("../../../supabase/functions/_shared/sentry.ts");
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env["SENTRY_DSN"];
  delete process.env["SENTRY_ENVIRONMENT"];
  delete (globalThis as { Deno?: DenoEnv }).Deno;
  vi.restoreAllMocks();
});

describe("edge Sentry sanitizing", () => {
  it("keeps the path and drops secrets, prompts, and lesson content", () => {
    const event: EdgeSentryEvent = {
      request: {
        url: `https://edge.example/ai-study?key=${apiKey}#lesson`,
        method: "POST",
        cookies: { session: "abc" },
        headers: { authorization: `Bearer ${apiKey}` },
        data: { prompt: lesson },
        query_string: `key=${apiKey}`,
        env: { GEMINI_API_KEY: apiKey },
      },
      user: { email: "student@example.com" },
      breadcrumbs: [{ message: lesson }],
      extra: { lesson },
      contexts: { request: { headers: { cookie: "session=abc" } }, response: { body: lesson } },
    };

    sanitizeEdgeSentryEvent(event);

    expect(event.request).toEqual({ method: "POST", url: "/ai-study" });
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.contexts).toEqual({});
    expect(JSON.stringify(event)).not.toContain(apiKey);
    expect(JSON.stringify(event)).not.toContain(lesson);
    expect(JSON.stringify(event)).not.toContain("student@example.com");
  });
});

describe("edge Sentry reporting", () => {
  it("does not initialize when SENTRY_DSN is missing", async () => {
    const { reportEdgeFailure: report } = await loadReporter();
    const sdk = fakeSdk();

    await report({ source: "gemini", status: 500, detail: "upstream failed" }, sdk);

    expect(sdk.initWithoutDefaultIntegrations).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
    expect(sdk.flush).not.toHaveBeenCalled();
  });

  it("initializes the Deno SDK once and flushes a sanitized failure", async () => {
    process.env["SENTRY_DSN"] = `  ${dsn}  `;
    process.env["SENTRY_ENVIRONMENT"] = "production";
    const { reportEdgeFailure: report } = await loadReporter();
    const sdk = fakeSdk();
    const entry = {
      source: "gemini",
      status: 500,
      errorType: "UNAVAILABLE",
      errorCode: "500",
      detail: `upstream ${apiKey} student@example.com ${lesson}`,
    };

    await report(entry, sdk);
    await report(entry, sdk);

    expect(sdk.initWithoutDefaultIntegrations).toHaveBeenCalledTimes(1);
    expect(sdk.initWithoutDefaultIntegrations.mock.calls[0]?.[0]).toMatchObject({
      dsn,
      environment: "production",
      enableOpenTelemetrySetup: false,
      enableRuntimeChannelInjection: false,
      tracesSampleRate: 0,
      tracePropagationTargets: [],
      enhanceFetchErrorMessages: false,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
        genAI: { inputs: false, outputs: false },
      },
    });
    expect(sdk.captureException).toHaveBeenCalledTimes(2);
    const captured = sdk.captureException.mock.calls[0]?.[0] as Error;
    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toBe("gemini 500 UNAVAILABLE 500");
    expect(captured.message).not.toContain(apiKey);
    expect(captured.message).not.toContain(lesson);
    expect(captured.message).not.toContain("student@example.com");
    expect(sdk.flush).toHaveBeenCalledTimes(2);
    expect(sdk.flush).toHaveBeenCalledWith(2_000);

    const options = sdk.initWithoutDefaultIntegrations.mock.calls[0]?.[0] as {
      beforeSend: (event: EdgeSentryEvent) => EdgeSentryEvent;
    };
    const event: EdgeSentryEvent = {
      request: { url: "/lesson?access_token=secret", headers: { cookie: "a" }, data: lesson },
    };
    expect(options.beforeSend(event).request).toEqual({ url: "/lesson" });
  });

  it("reads the Edge Function DSN from Deno.env", async () => {
    process.env["SENTRY_DSN"] = "https://wrong.example/1";
    (globalThis as { Deno?: DenoEnv }).Deno = {
      env: { get: (name) => (name === "SENTRY_DSN" ? dsn : undefined) },
    };
    const { reportEdgeFailure: report } = await loadReporter();
    const sdk = fakeSdk();

    await report({ source: "youtube", status: 500 }, sdk);

    expect(sdk.initWithoutDefaultIntegrations.mock.calls[0]?.[0]).toMatchObject({ dsn });
  });

  it("does not report auth, validation, missing keys, or the application rate limit", async () => {
    process.env["SENTRY_DSN"] = dsn;
    const { reportEdgeFailure: report } = await loadReporter();
    const sdk = fakeSdk();
    const skipped = [
      { source: "gemini", status: 401, detail: "API key not valid. [redacted]" },
      { source: "youtube", status: 403 },
      {
        source: "request",
        status: 400,
        errorType: "validation",
        detail: "Enter the number of lessons.",
      },
      { source: "gemini", status: null, detail: "AI is not configured." },
      { source: "youtube", status: null, detail: "Video suggestions are not configured." },
      { source: "gemini", status: null, detail: "The AI response was not valid." },
      { source: "ai-rate-limit", status: 429, detail: "Too many AI requests. Try again later." },
    ] as const;

    for (const entry of skipped) await report(entry, sdk);

    expect(sdk.initWithoutDefaultIntegrations).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it("still reports an upstream provider rate limit", async () => {
    process.env["SENTRY_DSN"] = dsn;
    const { reportEdgeFailure: report } = await loadReporter();
    const sdk = fakeSdk();

    await report(
      { source: "gemini", status: 429, kind: "rate_limit", detail: "quota exceeded" },
      sdk,
    );

    expect(sdk.captureException).toHaveBeenCalledTimes(1);
  });

  it("resolves when initialization fails", async () => {
    process.env["SENTRY_DSN"] = dsn;
    const { reportEdgeFailure: report } = await loadReporter();
    const sdk = fakeSdk();
    sdk.initWithoutDefaultIntegrations.mockImplementation(() => {
      throw new Error("invalid dsn");
    });

    await expect(
      report({ source: "gemini", status: 500, detail: "upstream" }, sdk),
    ).resolves.toBeUndefined();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it("resolves when flushing fails", async () => {
    process.env["SENTRY_DSN"] = dsn;
    const { reportEdgeFailure: report } = await loadReporter();
    const sdk = fakeSdk();
    sdk.flush.mockRejectedValue(new Error("network"));

    await expect(
      report({ source: "ollama-chat", status: 500, kind: "server", detail: "upstream" }, sdk),
    ).resolves.toBeUndefined();
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
  });
});

describe("existing AI failure logs", () => {
  it("keeps the redacted Gemini JSON log and does not throw when reporting fails", async () => {
    process.env["SENTRY_DSN"] = dsn;
    const logged: unknown[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => {
      logged.push(message);
    });
    const entry = {
      status: 500,
      errorType: "UNAVAILABLE",
      errorCode: "500",
      detail: "upstream failed",
    };

    logAiFailure(entry);
    await settleEdgeReports();

    expect(logged).toEqual([
      JSON.stringify({
        source: "gemini",
        status: 500,
        errorType: "UNAVAILABLE",
        errorCode: "500",
        detail: "upstream failed",
      }),
    ]);
  });

  it("does not log a missing YouTube key", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await searchLearningVideos({ apiKey: "  ", query: "Plant cells", limit: 3 }, vi.fn());

    expect(logged).not.toHaveBeenCalled();
  });

  it("routes the existing failure logs through the shared reporter", () => {
    const gemini = readFileSync(join(shared, "gemini.ts"), "utf8");
    const embeddings = readFileSync(join(shared, "embeddings.ts"), "utf8");
    const ollama = readFileSync(join(shared, "ollama-chat.ts"), "utf8");
    const videos = readFileSync(join(shared, "learning-videos.ts"), "utf8");

    expect(gemini).toContain("reportLoggedFailure");
    expect(embeddings).toContain('source: "gemini-embed"');
    expect(embeddings).toContain('source: "ollama-embed"');
    expect(ollama.match(/source: "ollama-chat"/g)).toHaveLength(3);
    expect(videos).toContain('source: "youtube"');
    expect(embeddings).not.toContain("console.error");
    expect(ollama).not.toContain("console.error");
    expect(videos).not.toContain("console.error");
  });
});
