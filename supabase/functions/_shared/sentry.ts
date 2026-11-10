// Supabase Edge Functions run on Deno. Load the Deno SDK only after a DSN is
// present so local tests and the web bundle do not initialize it.

const sentrySpecifier = "npm:@sentry/deno@11.11.0";
const flushTimeoutMs = 2_000;

const expectedDetails = new Set([
  "AI is not configured.",
  "Video suggestions are not configured.",
  "The AI response was not valid.",
  "Too many AI requests. Try again later.",
]);

export type EdgeFailureLog = {
  source: string;
  status: number | null;
  detail?: string;
  errorType?: string | null;
  errorCode?: string | null;
  kind?: string;
};

export type EdgeSentryEvent = {
  request?: {
    url?: string;
    method?: string;
    data?: unknown;
    query_string?: unknown;
    cookies?: unknown;
    env?: unknown;
    headers?: unknown;
  };
  breadcrumbs?: unknown;
  extra?: unknown;
  user?: unknown;
  contexts?: object;
};

type EdgeSentrySdk = {
  initWithoutDefaultIntegrations: (options: {
    dsn: string;
    enableOpenTelemetrySetup: false;
    enableRuntimeChannelInjection: false;
    integrations: { name: string }[];
    tracesSampleRate: 0;
    tracePropagationTargets: string[];
    enhanceFetchErrorMessages: false;
    dataCollection: ReturnType<typeof edgeDataCollection>;
    beforeSend: (event: EdgeSentryEvent) => EdgeSentryEvent;
    environment?: string;
  }) => unknown;
  captureException: (error: unknown) => unknown;
  flush: (timeout: number) => Promise<unknown>;
  linkedErrorsIntegration: () => { name: string };
  dedupeIntegration: () => { name: string };
};

let state: "pending" | "disabled" | "ready" = "pending";
const inflight = new Set<Promise<void>>();

export function shouldReportEdgeFailure(entry: EdgeFailureLog): boolean {
  if (entry.status === 401 || entry.status === 403) return false;
  if (entry.source === "ai-rate-limit") return false;
  if (entry.errorType === "validation") return false;
  const detail = entry.detail?.trim();
  if (detail && expectedDetails.has(detail)) return false;
  return true;
}

export function edgeDataCollection() {
  return {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  };
}

export function sanitizeEdgeSentryEvent<T extends EdgeSentryEvent>(event: T): T {
  const request = event.request;
  if (request) {
    const method = request.method;
    const url = requestPath(request.url);
    const scrubbed: NonNullable<EdgeSentryEvent["request"]> = {};
    if (typeof method === "string" && method.length > 0) scrubbed.method = method;
    if (url) scrubbed.url = url;
    event.request = scrubbed;
  }
  delete event.breadcrumbs;
  delete event.extra;
  delete event.user;
  if (event.contexts) {
    const contexts = event.contexts as Record<string, unknown>;
    delete contexts["request"];
    delete contexts["response"];
  }
  return event;
}

function requestPath(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const path = new URL(url, "http://localhost").pathname;
    return path.length > 0 ? path : undefined;
  } catch {
    const path = url.split(/[?#]/, 1)[0];
    return path && path.length > 0 ? path : undefined;
  }
}

function configuredString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readEnv(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } })
    .Deno;
  const fromDeno = deno?.env?.get?.(name);
  if (typeof fromDeno === "string" && fromDeno.trim()) return fromDeno;
  if (typeof process !== "undefined" && typeof process.env?.[name] === "string") {
    return process.env[name];
  }
  return undefined;
}

function loadEdgeSentry(): Promise<EdgeSentrySdk> {
  return import(/* @vite-ignore */ sentrySpecifier) as Promise<EdgeSentrySdk>;
}

function ensureEdgeSentry(sdk: EdgeSentrySdk): boolean {
  if (state === "ready") return true;
  if (state === "disabled") return false;
  const dsn = configuredString(readEnv("SENTRY_DSN"));
  if (!dsn) {
    state = "disabled";
    return false;
  }
  try {
    const environment = configuredString(readEnv("SENTRY_ENVIRONMENT"));
    sdk.initWithoutDefaultIntegrations({
      dsn,
      enableOpenTelemetrySetup: false,
      enableRuntimeChannelInjection: false,
      integrations: [sdk.linkedErrorsIntegration(), sdk.dedupeIntegration()],
      tracesSampleRate: 0,
      tracePropagationTargets: [],
      enhanceFetchErrorMessages: false,
      dataCollection: edgeDataCollection(),
      beforeSend(event) {
        sanitizeEdgeSentryEvent(event);
        return event;
      },
      ...(environment ? { environment } : {}),
    });
    state = "ready";
    return true;
  } catch {
    state = "disabled";
    return false;
  }
}

function failureError(entry: EdgeFailureLog): Error {
  const parts = [entry.source, entry.status === null ? "network" : String(entry.status)];
  if (entry.kind) parts.push(entry.kind);
  if (entry.errorType) parts.push(entry.errorType);
  if (entry.errorCode) parts.push(entry.errorCode);
  const error = new Error(parts.join(" "));
  error.name = "EdgeFunctionFailure";
  return error;
}

export async function reportEdgeFailure(entry: EdgeFailureLog, sdk?: EdgeSentrySdk): Promise<void> {
  try {
    if (!shouldReportEdgeFailure(entry)) return;
    const client = sdk ?? (await loadEdgeSentry());
    if (!ensureEdgeSentry(client)) return;
    client.captureException(failureError(entry));
    await client.flush(flushTimeoutMs);
  } catch {
    // The Edge Function response stays the generic error already returned.
  }
}

export function reportLoggedFailure(entry: EdgeFailureLog): void {
  const payload: Record<string, unknown> = {
    source: entry.source,
    status: entry.status,
  };
  if ("errorType" in entry) payload["errorType"] = entry.errorType;
  if ("errorCode" in entry) payload["errorCode"] = entry.errorCode;
  if ("kind" in entry) payload["kind"] = entry.kind;
  if ("detail" in entry) payload["detail"] = entry.detail;
  console.error(JSON.stringify(payload));
  deferEdgeReport(reportEdgeFailure(entry));
}

export function deferEdgeReport(task: Promise<void>): void {
  const settled = task.finally(() => {
    inflight.delete(settled);
  });
  inflight.add(settled);
  try {
    const runtime = (
      globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }
    ).EdgeRuntime;
    if (typeof runtime?.waitUntil === "function") runtime.waitUntil(settled);
  } catch {
    // The report still finishes in the background.
  }
}

export function settleEdgeReports(): Promise<void> {
  return Promise.all([...inflight]).then(() => undefined);
}
