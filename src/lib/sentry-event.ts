// Shared scrubber for browser and server events. The SDKs stay uninitialized
// until a DSN is present; this only removes data we do not want on an event.

export type SentryEventScrub = {
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

export function configuredString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const dsn = value.trim();
  return dsn.length > 0 ? dsn : undefined;
}

export function sentryDataCollection() {
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

// Keep the path so the issue is identifiable, and drop query, hash, headers,
// cookies, and bodies. Those can carry tokens, prompts, or lesson text.
export function sanitizeSentryEvent<T extends SentryEventScrub>(event: T): T {
  const request = event.request;
  if (request) {
    const method = request.method;
    const url = requestPath(request.url);
    const scrubbed: NonNullable<SentryEventScrub["request"]> = {};
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
