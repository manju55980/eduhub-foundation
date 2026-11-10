import * as Sentry from "@sentry/react";

import { configuredString, sanitizeSentryEvent, sentryDataCollection } from "./sentry-event";

let state: "pending" | "disabled" | "ready" = "pending";

function ensureBrowserSentry(): boolean {
  if (state === "ready") return true;
  if (state === "disabled") return false;
  const dsn = configuredString(import.meta.env["VITE_SENTRY_DSN"]);
  if (!dsn) {
    state = "disabled";
    return false;
  }
  try {
    const environment = import.meta.env.MODE;
    Sentry.init({
      dsn,
      defaultIntegrations: false,
      integrations: [Sentry.linkedErrorsIntegration(), Sentry.dedupeIntegration()],
      tracesSampleRate: 0,
      enhanceFetchErrorMessages: false,
      dataCollection: sentryDataCollection(),
      beforeSend(event) {
        sanitizeSentryEvent(event);
        return event;
      },
      ...(typeof environment === "string" && environment.length > 0 ? { environment } : {}),
    });
    state = "ready";
    return true;
  } catch {
    state = "disabled";
    return false;
  }
}

// Browser-only. SSR errors are reported from the Node SDK in server.ts and start.ts.
export function captureBrowserException(error: unknown): void {
  if (typeof window === "undefined") return;
  try {
    if (!ensureBrowserSentry()) return;
    Sentry.captureException(error);
  } catch {
    // The existing error screen still renders when reporting fails.
  }
}
