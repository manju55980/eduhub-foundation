import { beforeEach, describe, expect, it, vi } from "vitest";

import { enrollInCourse } from "@/features/student/browse-courses-api";
import { updateOwnProfile } from "@/features/auth/auth-api";

import type { AgentReader } from "../../../supabase/functions/_shared/agent-tools.ts";
import { handleAgent } from "../../../supabase/functions/_shared/handle-agent.ts";
import {
  bindDeliveryStore,
  bindStudentDb,
  deliveryEventKey,
  emailClaimKey,
  handleResendWebhook,
  handleStudentEmail,
  hubspotContactBody,
  hubspotUpsertUrl,
  resendEmailUrl,
  syncStudent,
  webhookSignatureMessage,
  type DeliveryStore,
  type EventWriteClient,
  type IntegrationSecrets,
  type OutboundStore,
  type StudentDb,
} from "../../../supabase/functions/_shared/student-integrations.ts";

const { from, invoke } = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

const courseId = "11111111-1111-4111-8111-111111111111";
const enrollmentId = "22222222-2222-4222-8222-222222222222";
const webhookSecret = `whsec_${btoa("eduHub-webhook-secret")}`;
const signedAt = "1700000000";
const nowMs = 1_700_000_000_000;
const secrets: IntegrationSecrets = {
  resendKey: "re_test",
  resendFrom: "EduHub <notifications@example.com>",
  hubspotToken: "pat-test",
};

describe("student email and HubSpot sync", () => {
  it("sends one enrolment email and upserts the contact by email", async () => {
    const store = memoryStore();
    const calls = await syncWith(store, "enrolment", {
      resend: jsonResponse({ id: "email-1" }),
      hubspot: jsonResponse({ status: "COMPLETE", results: [{ id: "1", new: true }] }),
    });

    expect(calls.map((call) => call.url).sort()).toEqual([hubspotUpsertUrl, resendEmailUrl].sort());
    const email = calls.find((call) => call.url === resendEmailUrl);
    const contact = calls.find((call) => call.url === hubspotUpsertUrl);
    expect(email?.headers["idempotency-key"]).toBe(emailClaimKey("enrolment", enrollmentId));
    expect(email?.headers["authorization"]).toBe("Bearer re_test");
    expect(email?.body).toMatchObject({
      to: ["ada@example.com"],
      subject: "You are enrolled",
      text: "You are enrolled in Algebra.",
    });
    expect(contact?.body).toEqual(hubspotContactBody("ada@example.com", "Ada Lovelace"));
    expect(JSON.stringify(contact?.body)).not.toContain("phone");
    expect(JSON.stringify(contact?.body)).not.toContain("objectWriteTraceId");
    expect(store.marked()).toBe(1);
    expect(store.released()).toBe(0);
    expect(store.keys()).toEqual([emailClaimKey("enrolment", enrollmentId)]);
  });

  it("keeps the HubSpot call when Resend fails and releases the claim", async () => {
    const store = memoryStore();
    const calls = await syncWith(store, "certificate", {
      resend: new Response("no", { status: 500 }),
      hubspot: jsonResponse({ status: "COMPLETE", results: [] }),
    });

    expect(calls.map((call) => call.url)).toContain(hubspotUpsertUrl);
    expect(calls.map((call) => call.url)).toContain(resendEmailUrl);
    expect(store.released()).toBe(1);
    expect(store.marked()).toBe(0);
    expect(store.keys()).toEqual([]);
    expect(calls.find((call) => call.url === resendEmailUrl)?.headers["idempotency-key"]).toBe(
      emailClaimKey("certificate", enrollmentId),
    );
  });

  it("does not release a claim when Resend reports a concurrent idempotency key", async () => {
    const store = memoryStore();
    await syncWith(store, "enrolment", {
      resend: new Response("concurrent", { status: 409 }),
      hubspot: jsonResponse({ status: "COMPLETE", results: [] }),
    });
    expect(store.released()).toBe(0);
    expect(store.marked()).toBe(0);
    expect(store.keys()).toEqual([emailClaimKey("enrolment", enrollmentId)]);
  });

  it("does not send a second email after the claim exists, and still syncs the contact", async () => {
    const store = memoryStore();
    await syncWith(store, "enrolment", {
      resend: jsonResponse({ id: "email-1" }),
      hubspot: jsonResponse({ status: "COMPLETE", results: [] }),
    });
    const calls = await syncWith(store, "enrolment", {
      resend: jsonResponse({ id: "email-2" }),
      hubspot: jsonResponse({ status: "COMPLETE", results: [] }),
    });
    expect(calls.map((call) => call.url)).toEqual([hubspotUpsertUrl]);
    expect(store.marked()).toBe(1);
  });

  it("skips a missing provider without calling it", async () => {
    const store = memoryStore();
    const withoutResend = await syncWith(
      store,
      "enrolment",
      {
        resend: jsonResponse({ id: "email-1" }),
        hubspot: jsonResponse({ status: "COMPLETE", results: [] }),
      },
      { ...secrets, resendKey: undefined },
    );
    expect(withoutResend.map((call) => call.url)).toEqual([hubspotUpsertUrl]);
    expect(store.keys()).toEqual([]);

    const withoutHubspot = await syncWith(
      store,
      "enrolment",
      {
        resend: jsonResponse({ id: "email-1" }),
        hubspot: jsonResponse({ status: "COMPLETE", results: [] }),
      },
      { ...secrets, hubspotToken: undefined },
    );
    expect(withoutHubspot.map((call) => call.url)).toEqual([resendEmailUrl]);
  });

  it("does not call either provider when the profile email is blank", async () => {
    const calls: string[] = [];
    const result = await syncStudent({
      studentId: "student-1",
      email: "  ",
      fullName: "Ada",
      enrollmentId,
      courseTitle: "Algebra",
      send: "enrolment",
      secrets,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return jsonResponse({});
      },
      store: memoryStore(),
    });
    expect(result).toEqual({ emailed: false, synced: false });
    expect(calls).toEqual([]);
  });

  it("claims with an atomic ignore-duplicates insert", async () => {
    const calls: Array<{ values: Record<string, unknown>; options: unknown }> = [];
    const client = {
      from: () => ({
        select: () => chain({ data: null, error: null }),
        upsert: (values: Record<string, unknown>, options: unknown) => {
          calls.push({ values, options });
          return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
        },
        update: () => chain({ data: null, error: null }),
        delete: () => chain({ data: null, error: null }),
      }),
    } as EventWriteClient;
    const claimed = await bindStudentDb(client).claim("student-1", "enrolment:enrollment-1");
    expect(claimed).toEqual({ ok: true, id: null });
    expect(calls[0]?.options).toEqual({ onConflict: "event_key", ignoreDuplicates: true });
    expect(calls[0]?.values).toMatchObject({
      event_key: "enrolment:enrollment-1",
      student_id: "student-1",
      kind: "outbound",
      status: "pending",
      provider_email_id: null,
    });
  });

  it("stores a delivery with the same ignore-duplicates insert", async () => {
    const calls: Array<{ values: Record<string, unknown>; options: unknown }> = [];
    const client = {
      from: () => ({
        select: () => chain({ data: null, error: null }),
        upsert: (values: Record<string, unknown>, options: unknown) => {
          calls.push({ values, options });
          return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
        },
        update: () => chain({ data: null, error: null }),
        delete: () => chain({ data: null, error: null }),
      }),
    } as EventWriteClient;
    const saved = await bindDeliveryStore(client).record({
      eventKey: "delivery:msg_1",
      status: "email.complained",
      providerEmailId: "email-1",
    });
    expect(saved).toEqual({ ok: true, stored: false });
    expect(calls[0]?.options).toEqual({ onConflict: "event_key", ignoreDuplicates: true });
    expect(calls[0]?.values).toMatchObject({
      event_key: "delivery:msg_1",
      student_id: null,
      kind: "delivery",
      status: "email.complained",
    });
  });
});

describe("student-email requests", () => {
  const reader = studentReader();

  it("rejects a service-role key before reading the student", async () => {
    const reads: string[] = [];
    const response = await handleStudentEmail(emailRequest({ action: "profile" }), {
      supabaseUrl: "http://localhost:54321",
      publishableKey: `header.${btoa(JSON.stringify({ role: "service_role" }))}.sig`,
      authorization: "Bearer a.b.c",
      secrets,
      fetchImpl: async () => jsonResponse({}),
      reader: {
        ...reader,
        async userId() {
          reads.push("user");
          return { ok: true, userId: "student-1" };
        },
      },
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, message: "Email is not configured." });
    expect(reads).toEqual([]);
  });

  it("does not email or sync a non-student", async () => {
    const calls: string[] = [];
    const response = await handleStudentEmail(emailRequest({ action: "profile" }), {
      supabaseUrl: "http://localhost:54321",
      publishableKey: "sb_publishable_test",
      authorization: "Bearer a.b.c",
      secrets,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return jsonResponse({ status: "COMPLETE", results: [] });
      },
      reader: studentReader("instructor"),
    });
    expect(response.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("does not send a certificate email before the course is completed", async () => {
    const calls: string[] = [];
    const reader = studentReader();
    reader.enrollment = async () => ({
      ok: true,
      enrollment: { id: enrollmentId, status: "active", title: "Algebra" },
    });
    const response = await handleStudentEmail(emailRequest({ action: "completion", courseId }), {
      supabaseUrl: "http://localhost:54321",
      publishableKey: "sb_publishable_test",
      authorization: "Bearer a.b.c",
      secrets,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return jsonResponse({ status: "COMPLETE", results: [] });
      },
      reader,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, emailed: false, synced: true });
    expect(calls).toEqual([hubspotUpsertUrl]);
  });
});

describe("Resend delivery webhook", () => {
  it("accepts a valid signature and stores one delivery event", async () => {
    const payload = JSON.stringify({
      type: "email.delivered",
      data: { email_id: "email-1" },
    });
    const store = deliveryMemory();
    const first = await postWebhook(payload, store, signedAt);
    const second = await postWebhook(payload, store, signedAt);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, stored: true });
    expect(await second.json()).toMatchObject({ ok: true, stored: false });
    expect([...store.keys]).toEqual([deliveryEventKey("msg_1")]);
  });

  it("rejects a changed body, a stale timestamp, and a missing secret before writing", async () => {
    const payload = JSON.stringify({ type: "email.bounced", data: { email_id: "email-1" } });
    const store = deliveryMemory();
    const signed = await signedRequest(payload, signedAt);
    const tampered = await handleResendWebhook(
      new Request(signed.url, {
        method: "POST",
        headers: signed.headers,
        body: `${payload} `,
      }),
      { webhookSecret, store, nowMs },
    );
    const stale = await postWebhook(payload, store, String(Number(signedAt) - 600));
    const missing = await handleResendWebhook(await signedRequest(payload, signedAt), {
      webhookSecret: "  ",
      store,
      nowMs,
    });
    expect(tampered.status).toBe(400);
    expect(await tampered.json()).toMatchObject({ message: webhookSignatureMessage });
    expect(stale.status).toBe(400);
    expect(missing.status).toBe(500);
    expect(store.keys.size).toBe(0);
  });

  it("does not write a valid delivery when the service-role store is missing", async () => {
    const payload = JSON.stringify({ type: "email.sent", data: { email_id: "email-1" } });
    const response = await handleResendWebhook(await signedRequest(payload, signedAt), {
      webhookSecret,
      store: null,
      nowMs,
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, message: "Email is not configured." });
  });

  it("accepts an unknown event without storing it", async () => {
    const payload = JSON.stringify({ type: "email.opened", data: { email_id: "email-1" } });
    const store = deliveryMemory();
    const response = await postWebhook(payload, store, signedAt);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, stored: false });
    expect(store.keys.size).toBe(0);
  });
});

describe("existing student workflows", () => {
  beforeEach(() => {
    from.mockReset();
    invoke.mockReset();
  });

  it("keeps a saved enrolment when the email function fails", async () => {
    from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });
    invoke.mockResolvedValue({ data: null, error: { message: "The email function failed." } });
    const result = await enrollInCourse("student-1", courseId);
    expect(result).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith("student-email", {
      body: { action: "enrolment", courseId },
    });
  });

  it("does not email when the enrolment insert fails", async () => {
    from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: "duplicate" } }),
    });
    const result = await enrollInCourse("student-1", courseId);
    expect(result.ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("syncs a saved profile without failing the save", async () => {
    from.mockReturnValue({
      update: () => ({ eq: async () => ({ error: null }) }),
    });
    invoke.mockRejectedValue(new Error("offline"));
    const result = await updateOwnProfile("student-1", {
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
    });
    expect(result).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith("student-email", { body: { action: "profile" } });
  });

  it("still answers after enrolment when the contact sync throws", async () => {
    let synced = "";
    const response = await handleAgent(agentRequest(), {
      supabaseUrl: "http://localhost:54321",
      publishableKey: "sb_publishable_test",
      geminiKey: "test-gemini-key",
      authorization: "Bearer a.b.c",
      fetchImpl: agentFetch(),
      reader: enrolReader(),
      syncEnrolment: async (userId, enrolledCourseId) => {
        synced = `${userId}:${enrolledCourseId}`;
        throw new Error("HubSpot is down");
      },
    });
    expect(synced).toBe(`student-1:${courseId}`);
    expect(await response.json()).toMatchObject({ ok: true, text: "You are enrolled." });
  });
});

function memoryStore(): OutboundStore & {
  keys: () => string[];
  marked: () => number;
  released: () => number;
} {
  const rows = new Map<string, { id: string; status: string; provider: string | null }>();
  let marked = 0;
  let released = 0;
  return {
    keys: () => [...rows.keys()],
    marked: () => marked,
    released: () => released,
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
          marked += 1;
          return { ok: true };
        }
      }
      return { ok: false };
    },
    async release(id) {
      for (const [key, row] of rows) {
        if (row.id === id && row.status === "pending" && !row.provider) {
          rows.delete(key);
          released += 1;
        }
      }
    },
  };
}

function deliveryMemory(): DeliveryStore & { keys: Set<string> } {
  const keys = new Set<string>();
  return {
    keys,
    async record(input) {
      if (keys.has(input.eventKey)) return { ok: true, stored: false };
      keys.add(input.eventKey);
      return { ok: true, stored: true };
    },
  };
}

async function syncWith(
  store: OutboundStore,
  send: "enrolment" | "certificate",
  responses: { resend: Response; hubspot: Response },
  nextSecrets: IntegrationSecrets = secrets,
) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: unknown }> = [];
  await syncStudent({
    studentId: "student-1",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    enrollmentId,
    courseTitle: "Algebra",
    send,
    secrets: nextSecrets,
    store,
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        headers: Object.fromEntries(headers.entries()),
        body: JSON.parse(String(init?.body)),
      });
      return String(input) === resendEmailUrl ? responses.resend : responses.hubspot;
    },
  });
  return calls;
}

function studentReader(role = "student"): StudentDb & {
  userId: () => Promise<{ ok: true; userId: string }>;
} {
  return {
    ...memoryStore(),
    async userId() {
      return { ok: true, userId: "student-1" };
    },
    async profile() {
      return {
        ok: true,
        profile: { email: "ada@example.com", fullName: "Ada Lovelace", role },
      };
    },
    async enrollment() {
      return {
        ok: true,
        enrollment: { id: enrollmentId, status: "completed", title: "Algebra" },
      };
    },
  };
}

function emailRequest(body: unknown) {
  return new Request("http://localhost/student-email", {
    method: "POST",
    headers: { Authorization: "Bearer a.b.c" },
    body: JSON.stringify(body),
  });
}

async function postWebhook(payload: string, store: DeliveryStore, timestamp: string) {
  return handleResendWebhook(await signedRequest(payload, timestamp), {
    webhookSecret,
    store,
    nowMs,
  });
}

async function signedRequest(payload: string, timestamp: string) {
  return new Request("http://localhost/resend-webhook", {
    method: "POST",
    headers: {
      "svix-id": "msg_1",
      "svix-timestamp": timestamp,
      "svix-signature": await svixSignature(webhookSecret, "msg_1", timestamp, payload),
    },
    body: payload,
  });
}

async function svixSignature(secret: string, id: string, timestamp: string, payload: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const raw = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${payload}`),
  );
  let binary = "";
  for (const byte of new Uint8Array(mac)) binary += String.fromCharCode(byte);
  return `v1,${btoa(binary)}`;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function chain(result: {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}) {
  const query = {
    eq: () => query,
    is: () => query,
    select: () => ({ maybeSingle: async () => result }),
    maybeSingle: async () => result,
  };
  return query;
}

function agentRequest() {
  return new Request("http://localhost/ai-agent", {
    method: "POST",
    headers: { Authorization: "Bearer a.b.c" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Please enrol me in Algebra" }] }),
  });
}

function agentFetch(): typeof fetch {
  let calls = 0;
  return async () => {
    calls += 1;
    const value =
      calls === 1
        ? { type: "tool", name: "enrol_in_course", arguments: { courseId } }
        : { type: "answer", text: "You are enrolled.", courses: [] };
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
}

function enrolReader(): AgentReader {
  const unused = async () => {
    throw new Error("unused");
  };
  return {
    async userId() {
      return { ok: true, userId: "student-1" };
    },
    async role() {
      return { ok: true, role: "student" };
    },
    matchKnowledge: unused,
    course: unused,
    enrolled: unused,
    lessons: unused,
    async enrol() {
      return { ok: true, title: "Algebra", courseId, already: false };
    },
    grades: unused,
    catalogue: unused,
    publishedCount: unused,
  };
}
