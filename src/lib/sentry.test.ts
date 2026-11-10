import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { sanitizeSentryEvent, type SentryEventScrub } from "./sentry-event";

const browserSdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  linkedErrorsIntegration: vi.fn(() => ({ name: "LinkedErrors" })),
  dedupeIntegration: vi.fn(() => ({ name: "Dedupe" })),
}));

const serverSdk = vi.hoisted(() => ({
  initWithoutDefaultIntegrations: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
  linkedErrorsIntegration: vi.fn(() => ({ name: "LinkedErrors" })),
  dedupeIntegration: vi.fn(() => ({ name: "Dedupe" })),
}));

vi.mock("@sentry/react", () => browserSdk);
vi.mock("@sentry/node", () => serverSdk);

const dsn = "https://public@example.ingest.sentry.io/1";
const root = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env["SENTRY_DSN"];
  delete process.env["SENTRY_ENVIRONMENT"];
  delete process.env["VERCEL_ENV"];
  browserSdk.init.mockClear();
  browserSdk.captureException.mockClear();
  serverSdk.initWithoutDefaultIntegrations.mockClear();
  serverSdk.captureException.mockClear();
  serverSdk.flush.mockClear();
});

async function loadBrowser() {
  vi.resetModules();
  return import("./sentry-browser");
}

async function loadServer() {
  vi.resetModules();
  return import("./sentry-server");
}

describe("Sentry event scrubbing", () => {
  it("keeps the path and drops request secrets, prompts, and lesson content", () => {
    const event: SentryEventScrub = {
      request: {
        url: "https://eduhub.example/courses/1?token=secret#lesson",
        method: "POST",
        cookies: { session: "abc" },
        headers: { authorization: "Bearer secret" },
        data: { prompt: "lesson text" },
        query_string: "token=secret",
        env: { GEMINI_API_KEY: "secret" },
      },
      user: { email: "student@example.com" },
      breadcrumbs: [{ message: "prompt" }],
      extra: { lesson: "content" },
      contexts: { request: { headers: { cookie: "session=abc" } }, response: { body: "lesson" } },
    };

    sanitizeSentryEvent(event);

    expect(event.request).toEqual({ method: "POST", url: "/courses/1" });
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.contexts).toEqual({});
    expect(JSON.stringify(event)).not.toContain("secret");
    expect(JSON.stringify(event)).not.toContain("lesson");
    expect(JSON.stringify(event)).not.toContain("student@example.com");
  });
});

describe("browser Sentry", () => {
  it("does not initialize when VITE_SENTRY_DSN is missing", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "  ");
    const { captureBrowserException } = await loadBrowser();

    captureBrowserException(new Error("boom"));

    expect(browserSdk.init).not.toHaveBeenCalled();
    expect(browserSdk.captureException).not.toHaveBeenCalled();
  });

  it("initializes once and reports the caught error", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", dsn);
    const { captureBrowserException } = await loadBrowser();
    const first = new Error("first");
    const second = new Error("second");

    captureBrowserException(first);
    captureBrowserException(second);

    expect(browserSdk.init).toHaveBeenCalledTimes(1);
    expect(browserSdk.init.mock.calls[0]?.[0]).toMatchObject({
      dsn,
      defaultIntegrations: false,
      tracesSampleRate: 0,
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
    expect(browserSdk.captureException).toHaveBeenNthCalledWith(1, first);
    expect(browserSdk.captureException).toHaveBeenNthCalledWith(2, second);
  });

  it("scrubs the event passed to the browser SDK", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", dsn);
    const { captureBrowserException } = await loadBrowser();
    captureBrowserException(new Error("boom"));
    const options = browserSdk.init.mock.calls[0]?.[0] as {
      beforeSend: (event: SentryEventScrub) => SentryEventScrub;
    };
    const event: SentryEventScrub = {
      request: { url: "/lesson?access_token=secret", headers: { cookie: "a" }, data: "prompt" },
    };

    expect(options.beforeSend(event).request).toEqual({ url: "/lesson" });
  });

  it("keeps the error screen usable when initialization throws", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", dsn);
    browserSdk.init.mockImplementationOnce(() => {
      throw new Error("invalid dsn");
    });
    const { captureBrowserException } = await loadBrowser();

    expect(() => captureBrowserException(new Error("boom"))).not.toThrow();
    expect(browserSdk.captureException).not.toHaveBeenCalled();
  });
});

describe("server Sentry", () => {
  it("does not initialize when SENTRY_DSN is missing", async () => {
    delete process.env["SENTRY_DSN"];
    const { captureServerException } = await loadServer();

    await captureServerException(new Error("boom"));

    expect(serverSdk.initWithoutDefaultIntegrations).not.toHaveBeenCalled();
    expect(serverSdk.captureException).not.toHaveBeenCalled();
    expect(serverSdk.flush).not.toHaveBeenCalled();
  });

  it("initializes the Node SDK once and flushes on the Vercel runtime", async () => {
    process.env["SENTRY_DSN"] = dsn;
    process.env["VERCEL_ENV"] = "production";
    const { captureServerException } = await loadServer();
    const error = new Error("ssr");

    await captureServerException(error);
    await captureServerException(error);

    expect(serverSdk.initWithoutDefaultIntegrations).toHaveBeenCalledTimes(1);
    expect(serverSdk.initWithoutDefaultIntegrations.mock.calls[0]?.[0]).toMatchObject({
      dsn,
      environment: "production",
      enableRuntimeChannelInjection: false,
      tracesSampleRate: 0,
      enhanceFetchErrorMessages: false,
      dataCollection: { httpBodies: [], stackFrameVariables: false, userInfo: false },
    });
    expect(serverSdk.captureException).toHaveBeenCalledTimes(2);
    expect(serverSdk.flush).toHaveBeenCalledTimes(2);
    expect(serverSdk.flush).toHaveBeenCalledWith(2_000);
  });

  it("prefers SENTRY_ENVIRONMENT over VERCEL_ENV", async () => {
    process.env["SENTRY_DSN"] = dsn;
    process.env["SENTRY_ENVIRONMENT"] = "staging";
    process.env["VERCEL_ENV"] = "preview";
    const { captureServerException } = await loadServer();

    await captureServerException(new Error("ssr"));

    expect(serverSdk.initWithoutDefaultIntegrations.mock.calls[0]?.[0]).toMatchObject({
      environment: "staging",
    });
  });

  it("still resolves when the Node SDK flush fails", async () => {
    process.env["SENTRY_DSN"] = dsn;
    serverSdk.flush.mockRejectedValueOnce(new Error("network"));
    const { captureServerException } = await loadServer();

    await expect(captureServerException(new Error("ssr"))).resolves.toBeUndefined();
  });
});

describe("Sentry call sites", () => {
  const server = readFileSync(join(root, "../server.ts"), "utf8");
  const start = readFileSync(join(root, "../start.ts"), "utf8");
  const rootRoute = readFileSync(join(root, "../routes/__root.tsx"), "utf8");
  const errorCapture = readFileSync(join(root, "error-capture.ts"), "utf8");

  it("reports the same SSR errors that are already logged", () => {
    const reports = server.match(
      /console\.error\(error\);\r?\n\s*await captureServerException\(error\);/g,
    );
    expect(reports).toHaveLength(2);
    expect(start.indexOf('"statusCode" in error')).toBeLessThan(
      start.indexOf("console.error(error)"),
    );
    expect(start).toMatch(/console\.error\(error\);\r?\n\s*await captureServerException\(error\);/);
    expect(server.startsWith('import "./lib/error-capture";')).toBe(true);
  });

  it("reports browser boundary errors beside the Lovable hook", () => {
    const effect = rootRoute.slice(rootRoute.indexOf("useEffect(() => {"));
    expect(effect).toContain(
      'reportLovableError(error, { boundary: "tanstack_root_error_component" })',
    );
    expect(effect).toContain("captureBrowserException(error)");
    expect(rootRoute).not.toContain("@sentry/node");
    expect(start).not.toContain("@sentry/react");
    expect(server).not.toContain("@sentry/react");
  });

  it("does not wrap console.error again", () => {
    expect(errorCapture).toContain("console.error =");
    expect(readFileSync(join(root, "sentry-browser.ts"), "utf8")).not.toContain("console.error");
    expect(readFileSync(join(root, "sentry-server.ts"), "utf8")).not.toContain("console.error =");
  });
});
