import * as Sentry from "@sentry/node";

import { configuredString, sanitizeSentryEvent, sentryDataCollection } from "./sentry-event";

let state: "pending" | "disabled" | "ready" = "pending";

function ensureServerSentry(): boolean {
  if (state === "ready") return true;
  if (state === "disabled") return false;
  const dsn = configuredString(process.env["SENTRY_DSN"]);
  if (!dsn) {
    state = "disabled";
    return false;
  }
  try {
    const environment =
      configuredString(process.env["SENTRY_ENVIRONMENT"]) ??
      configuredString(process.env["VERCEL_ENV"]);
    // No default integrations: the Node SDK's console and HTTP hooks would
    // wrap console.error and attach request bodies. Vercel sets VERCEL, and
    // this init registers the SDK's Node keep-alive for that runtime.
    Sentry.initWithoutDefaultIntegrations({
      dsn,
      enableRuntimeChannelInjection: false,
      integrations: [Sentry.linkedErrorsIntegration(), Sentry.dedupeIntegration()],
      tracesSampleRate: 0,
      enhanceFetchErrorMessages: false,
      dataCollection: sentryDataCollection(),
      beforeSend(event) {
        sanitizeSentryEvent(event);
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

// The production server is a Vercel Node fetch handler. Flush before the
// response returns so the event is sent before the function freezes.
export async function captureServerException(error: unknown): Promise<void> {
  try {
    if (!ensureServerSentry()) return;
    Sentry.captureException(error);
    await Sentry.flush(2_000);
  } catch {
    // The existing handler still returns the error page.
  }
}
