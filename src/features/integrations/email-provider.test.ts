import { describe, expect, it } from "vitest";

import {
  createEmailProvider,
  deliveryEventKey,
  emailSenderAddress,
  normalizeResendDelivery,
  normalizeSmtp2goDelivery,
  selectedEmailProvider,
  smtp2goEmailUrl,
  verifySmtp2goAuthorization,
  type EmailProviderSecrets,
  type NormalizedDeliveryEvent,
} from "../../../supabase/functions/_shared/email-provider.ts";
import {
  emailClaimKey,
  hubspotUpsertUrl,
  integrationSecretsFromEnv,
  resendEmailUrl,
  syncStudent,
  type OutboundStore,
} from "../../../supabase/functions/_shared/student-integrations.ts";

const fromAddress = "EduHub <notifications@example.com>";
const webhookSecret = `whsec_${btoa("eduHub-webhook-secret")}`;
const enrollmentId = "22222222-2222-4222-8222-222222222222";

const resendSecrets: EmailProviderSecrets = {
  resendKey: "re_test",
  resendFrom: fromAddress,
  smtp2goKey: "re_test",
};

describe("provider selection", () => {
  it("keeps Resend when the provider is unset or named resend", () => {
    expect(selectedEmailProvider(undefined)).toBe("resend");
    expect(selectedEmailProvider("  Resend  ")).toBe("resend");
    expect(selectedEmailProvider("other")).toBeNull();
  });

  it("prefers the shared sender and falls back to the Resend sender", () => {
    expect(emailSenderAddress({ emailFrom: "  primary  ", resendFrom: "secondary" })).toBe(
      "primary",
    );
    expect(emailSenderAddress({ emailFrom: " ", resendFrom: " secondary " })).toBe("secondary");
    expect(emailSenderAddress({})).toBe("");
  });

  it("reads provider credentials from the function environment", () => {
    const values: Record<string, string> = {
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: fromAddress,
      RESEND_API_KEY: "re_test",
      RESEND_FROM: fromAddress,
      SMTP2GO_API_KEY: "re_test",
      HUBSPOT_ACCESS_TOKEN: "pat-test",
    };
    expect(integrationSecretsFromEnv((name) => values[name])).toEqual({
      emailProvider: "resend",
      emailFrom: fromAddress,
      resendKey: "re_test",
      resendFrom: fromAddress,
      smtp2goKey: "re_test",
      hubspotToken: "pat-test",
    });
  });

  it("sends with Resend from the shared sender and still syncs HubSpot", async () => {
    const calls = await sendWith(
      { ...resendSecrets, emailFrom: fromAddress, emailProvider: "resend" },
      {
        ok: true,
        body: { id: "email-1" },
      },
    );
    expect(calls.map((call) => call.url).sort()).toEqual([hubspotUpsertUrl, resendEmailUrl].sort());
    const email = calls.find((call) => call.url === resendEmailUrl);
    expect(email?.headers["authorization"]).toBe("Bearer re_test");
    expect(email?.headers["idempotency-key"]).toBe(emailClaimKey("enrolment", enrollmentId));
    expect(email?.body).toMatchObject({
      from: fromAddress,
      to: ["ada@example.com"],
      subject: "You are enrolled",
      text: "You are enrolled in Algebra.",
    });
  });

  it("does not send when the provider is unknown or the sender is missing", async () => {
    const unknown = await sendWith(
      { ...resendSecrets, emailProvider: "other" },
      {
        ok: true,
        body: { id: "email-1" },
      },
    );
    const missingSender = await sendWith(
      { resendKey: "re_test", hubspotToken: "pat-test" },
      {
        ok: true,
        body: { id: "email-1" },
      },
    );
    expect(unknown.map((call) => call.url)).toEqual([hubspotUpsertUrl]);
    expect(missingSender.map((call) => call.url)).toEqual([hubspotUpsertUrl]);
    expect(unknown[0]?.claimed).toBe(false);
  });

  it("does not fall back to Resend when SMTP2GO is selected without its key", async () => {
    const calls = await sendWith(
      { ...resendSecrets, emailProvider: "smtp2go", smtp2goKey: " " },
      {
        ok: true,
        body: { id: "email-1" },
      },
    );
    expect(calls.map((call) => call.url)).toEqual([hubspotUpsertUrl]);
  });

  it("sends through SMTP2GO only when that provider is selected", async () => {
    const store = memoryStore();
    const calls = await sendWith(
      { ...resendSecrets, emailProvider: "smtp2go" },
      {
        ok: true,
        body: { data: { succeeded: 1, failed: 0, failures: [], email_id: "email-1" } },
      },
      store,
    );
    expect(calls.map((call) => call.url).sort()).toEqual(
      [hubspotUpsertUrl, smtp2goEmailUrl].sort(),
    );
    const email = calls.find((call) => call.url === smtp2goEmailUrl);
    expect(email?.headers["x-smtp2go-api-key"]).toBe("re_test");
    expect(email?.headers["idempotency-key"]).toBeUndefined();
    expect(email?.body).toEqual({
      sender: fromAddress,
      to: ["ada@example.com"],
      subject: "You are enrolled",
      text_body: "You are enrolled in Algebra.",
    });
    expect(store.providerId()).toBe("email-1");

    const again = await sendWith(
      { ...resendSecrets, emailProvider: "smtp2go" },
      { ok: true, body: { data: { email_id: "email-2" } } },
      store,
    );
    expect(again.map((call) => call.url)).toEqual([hubspotUpsertUrl]);
  });

  it("releases the claim when SMTP2GO accepts the request but reports a failure", async () => {
    const store = memoryStore();
    await sendWith(
      { ...resendSecrets, emailProvider: "smtp2go" },
      {
        ok: true,
        body: { data: { succeeded: 0, failed: 1, failures: ["rejected"], email_id: "email-1" } },
      },
      store,
    );
    expect(store.providerId()).toBeNull();
    expect(store.pending()).toBe(false);
  });
});

describe("webhook normalization", () => {
  it("maps Resend deliveries onto the shared events", () => {
    const mapped: Array<[string, NormalizedDeliveryEvent]> = [
      ["email.sent", "sent"],
      ["email.delivered", "delivered"],
      ["email.opened", "opened"],
      ["email.bounced", "bounced"],
      ["email.failed", "failed"],
      ["email.complained", "failed"],
    ];
    for (const [type, event] of mapped) {
      expect(normalizeResendDelivery({ type, data: { email_id: " email-1 " } })).toEqual({
        event,
        providerEmailId: "email-1",
        eventId: null,
        suppressReason: type === "email.complained" ? "complaint" : null,
        suppressEmail: null,
      });
    }
    expect(normalizeResendDelivery({ type: "email.delivered" })).toEqual({
      event: "delivered",
      providerEmailId: null,
      eventId: null,
      suppressReason: null,
      suppressEmail: null,
    });
    for (const type of ["email.clicked", "email.delivery_delayed", "email.received"]) {
      expect(normalizeResendDelivery({ type, data: { email_id: "email-1" } })).toBeNull();
    }
  });

  it("maps SMTP2GO deliveries and keeps the provider event id", () => {
    const mapped: Array<[string, NormalizedDeliveryEvent]> = [
      ["processed", "sent"],
      ["delivered", "delivered"],
      ["open", "opened"],
      ["bounce", "bounced"],
      ["reject", "failed"],
      ["spam", "failed"],
    ];
    for (const [eventName, event] of mapped) {
      const delivery = normalizeSmtp2goDelivery({
        event: eventName,
        email_id: "email-1",
        id: "evt-1",
      });
      expect(delivery).toEqual({
        event,
        providerEmailId: "email-1",
        eventId: "evt-1",
        suppressReason: eventName === "spam" ? "complaint" : null,
        suppressEmail: null,
      });
      expect(deliveryEventKey("smtp2go", delivery?.eventId ?? "")).toBe("delivery:smtp2go:evt-1");
    }
    expect(
      normalizeSmtp2goDelivery({
        event: "unsubscribe",
        email_id: "email-1",
        id: "evt-1",
        rcpt: "ada@example.com",
      }),
    ).toEqual({
      event: null,
      providerEmailId: "email-1",
      eventId: "evt-1",
      suppressReason: "unsubscribe",
      suppressEmail: "ada@example.com",
    });
    for (const eventName of ["click", "resubscribe"]) {
      expect(normalizeSmtp2goDelivery({ event: eventName, id: "evt-1" })).toBeNull();
    }
    expect(
      normalizeSmtp2goDelivery({ event: "delivered", id: "x".repeat(201) })?.eventId,
    ).toBeNull();
    expect(deliveryEventKey("resend", "msg_1")).toBe("delivery:resend:msg_1");
  });

  it("checks the SMTP2GO bearer secret before an event can be trusted", () => {
    expect(verifySmtp2goAuthorization(undefined, `Bearer ${webhookSecret}`)).toBe(false);
    expect(verifySmtp2goAuthorization("  ", `Bearer ${webhookSecret}`)).toBe(false);
    expect(verifySmtp2goAuthorization(webhookSecret, null)).toBe(false);
    expect(verifySmtp2goAuthorization(webhookSecret, `Basic ${webhookSecret}`)).toBe(false);
    expect(verifySmtp2goAuthorization(webhookSecret, `Bearer ${webhookSecret}x`)).toBe(false);
    expect(verifySmtp2goAuthorization(`  ${webhookSecret}  `, `Bearer ${webhookSecret}`)).toBe(
      true,
    );
    expect(createEmailProvider({ emailProvider: "smtp2go" }, fetch)).toBeNull();
  });
});

async function sendWith(
  secrets: EmailProviderSecrets & { hubspotToken?: string },
  emailResponse: { ok: boolean; body: unknown },
  store: ReturnType<typeof memoryStore> = memoryStore(),
) {
  const calls: Array<{
    url: string;
    headers: Record<string, string>;
    body: unknown;
    claimed: boolean;
  }> = [];
  await syncStudent({
    studentId: "student-1",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    enrollmentId,
    courseTitle: "Algebra",
    send: "enrolment",
    secrets: { ...secrets, hubspotToken: secrets.hubspotToken ?? "pat-test" },
    store,
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        headers: Object.fromEntries(headers.entries()),
        body: JSON.parse(String(init?.body)),
        claimed: store.pending() || store.providerId() !== null,
      });
      if (String(input) === hubspotUpsertUrl) {
        return json({ status: "COMPLETE", results: [] });
      }
      return json(emailResponse.body, emailResponse.ok ? 200 : 500);
    },
  });
  return calls;
}

function memoryStore(): OutboundStore & {
  providerId: () => string | null;
  pending: () => boolean;
} {
  const rows = new Map<string, { id: string; status: string; provider: string | null }>();
  return {
    providerId: () => [...rows.values()].find((row) => row.provider)?.provider ?? null,
    pending: () => [...rows.values()].some((row) => row.status === "pending"),
    async claim(_studentId, eventKey) {
      if (rows.has(eventKey)) return { ok: true, id: null };
      const id = `row-${rows.size + 1}`;
      rows.set(eventKey, { id, status: "pending", provider: null });
      return { ok: true, id };
    },
    async markSent(id, providerEmailId) {
      for (const row of rows.values()) {
        if (row.id === id && row.status === "pending") {
          row.status = "sent";
          row.provider = providerEmailId;
          return { ok: true };
        }
      }
      return { ok: false };
    },
    async release(id) {
      for (const [key, row] of rows) {
        if (row.id === id && row.status === "pending" && !row.provider) rows.delete(key);
      }
    },
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
