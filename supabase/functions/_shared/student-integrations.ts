import { isServiceRoleKey } from "./user-client.ts";
import { jsonResponse, emptyResponse } from "./http.ts";

export const resendEmailUrl = "https://api.resend.com/emails";
export const hubspotUpsertUrl = "https://api.hubapi.com/crm/objects/2026-09/contacts/batch/upsert";
export const signatureWindowMs = 5 * 60 * 1000;
export const integrationTimeoutMs = 20_000;

export const emailNotConfiguredMessage = "Email is not configured.";
export const signedOutMessage = "You need to be signed in.";
export const studentOnlyMessage = "Only a student can use this.";
export const courseUnavailableMessage = "This course is not available.";
export const invalidRequestMessage = "The request was not valid.";
export const webhookSignatureMessage = "The webhook signature was not valid.";
export const requestFailedMessage = "The request could not be completed.";

export const deliveryEventTypes = [
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
] as const;

export type DeliveryEventType = (typeof deliveryEventTypes)[number];
export type StudentEmailAction = "enrolment" | "completion" | "profile";
export type OutboundEmail = "enrolment" | "certificate";

export type IntegrationSecrets = {
  resendKey?: string | undefined;
  resendFrom?: string | undefined;
  hubspotToken?: string | undefined;
};

export type OutboundStore = {
  claim: (
    studentId: string,
    eventKey: string,
  ) => Promise<{ ok: true; id: string | null } | { ok: false }>;
  markSent: (id: string, providerEmailId: string) => Promise<{ ok: true } | { ok: false }>;
  release: (id: string) => Promise<void>;
};

export type DeliveryStore = {
  record: (input: {
    eventKey: string;
    status: DeliveryEventType;
    providerEmailId: string | null;
  }) => Promise<{ ok: true; stored: boolean } | { ok: false }>;
};

export type StudentProfile = {
  email: string;
  fullName: string;
  role: string;
};

export type StudentEnrollment = {
  id: string;
  status: string;
  title: string;
};

export type StudentDb = OutboundStore & {
  profile: (userId: string) => Promise<{ ok: true; profile: StudentProfile } | { ok: false }>;
  enrollment: (
    userId: string,
    courseId: string,
  ) => Promise<{ ok: true; enrollment: StudentEnrollment | null } | { ok: false }>;
};

type QueryResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

type EventQuery = {
  eq: (column: string, value: string) => EventQuery;
  is: (column: string, value: null) => EventQuery;
  select: (columns: string) => { maybeSingle: () => Promise<QueryResult> };
  maybeSingle: () => Promise<QueryResult>;
};

export type EventWriteClient = {
  from: (table: string) => {
    select: (columns: string) => EventQuery;
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => { select: (columns: string) => { maybeSingle: () => Promise<QueryResult> } };
    update: (values: Record<string, unknown>) => EventQuery;
    delete: () => EventQuery;
  };
  auth?: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
};

export function contactName(fullName: string) {
  const parts = oneLine(fullName, "").split(" ").filter(Boolean);
  return {
    firstname: parts[0] ?? "",
    lastname: parts.slice(1).join(" "),
  };
}

export function hubspotContactBody(email: string, fullName: string) {
  const name = contactName(fullName);
  return {
    inputs: [
      {
        id: email,
        idProperty: "email",
        properties: {
          email,
          firstname: name.firstname,
          lastname: name.lastname,
        },
      },
    ],
  };
}

export function emailClaimKey(send: OutboundEmail, enrollmentId: string) {
  return send === "enrolment" ? `enrolment:${enrollmentId}` : `certificate:${enrollmentId}`;
}

export function deliveryEventKey(svixId: string) {
  return `delivery:${svixId}`;
}

export async function syncStudent(input: {
  studentId: string;
  email: string;
  fullName: string;
  enrollmentId: string | null;
  courseTitle: string;
  send: OutboundEmail | null;
  secrets: IntegrationSecrets;
  fetchImpl: typeof fetch;
  store: OutboundStore;
}) {
  const email = input.email.trim();
  if (!email) return { emailed: false, synced: false };
  const [emailed, synced] = await Promise.all([
    input.send && input.enrollmentId
      ? sendClaimedEmail(
          {
            studentId: input.studentId,
            email,
            enrollmentId: input.enrollmentId,
            courseTitle: input.courseTitle,
            send: input.send,
            secrets: input.secrets,
            fetchImpl: input.fetchImpl,
          },
          input.store,
        )
      : Promise.resolve(false),
    upsertContact(email, input.fullName, input.secrets.hubspotToken, input.fetchImpl),
  ]);
  return { emailed, synced };
}

export async function syncSavedEnrolment(
  db: StudentDb,
  userId: string,
  courseId: string,
  secrets: IntegrationSecrets,
  fetchImpl: typeof fetch,
) {
  try {
    const profile = await db.profile(userId);
    if (!profile.ok || profile.profile.role !== "student") return;
    const enrollment = await db.enrollment(userId, courseId);
    if (!enrollment.ok || !enrollment.enrollment) return;
    await syncStudent({
      studentId: userId,
      email: profile.profile.email,
      fullName: profile.profile.fullName,
      enrollmentId: enrollment.enrollment.id,
      courseTitle: enrollment.enrollment.title,
      send: "enrolment",
      secrets,
      fetchImpl,
      store: db,
    });
  } catch {
    return;
  }
}

export async function verifySvixSignature(input: {
  secret: string;
  id: string;
  timestamp: string;
  signature: string;
  payload: string;
  nowMs: number;
}) {
  if (!/^\d+$/.test(input.timestamp)) return false;
  const drift = Math.abs(input.nowMs - Number(input.timestamp) * 1000);
  if (drift > signatureWindowMs) return false;
  const secret = decodeWebhookSecret(input.secret);
  if (!secret) return false;
  const signed = `${input.id}.${input.timestamp}.${input.payload}`;
  let mac: ArrayBuffer;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      secretBuffer(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  } catch {
    return false;
  }
  const expected = encodeBase64(new Uint8Array(mac));
  const candidates = input.signature
    .split(" ")
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice("v1,".length));
  return candidates.some((candidate) => timingSafeEqual(candidate, expected));
}

export function deliveryFromPayload(
  payload: unknown,
): { type: DeliveryEventType; emailId: string | null } | null {
  if (!payload || typeof payload !== "object" || !("type" in payload)) return null;
  const type = payload.type;
  if (typeof type !== "string" || !isDeliveryEvent(type)) return null;
  let emailId: string | null = null;
  if (
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    "email_id" in payload.data
  ) {
    const value = payload.data.email_id;
    if (typeof value === "string" && value.trim()) emailId = value.trim();
  }
  return { type, emailId };
}

export async function handleStudentEmail(
  request: Request,
  deps: {
    supabaseUrl: string | undefined;
    publishableKey: string | undefined;
    authorization: string | null;
    secrets: IntegrationSecrets;
    fetchImpl: typeof fetch;
    reader: StudentDb & {
      userId: () => Promise<{ ok: true; userId: string } | { ok: false }>;
    };
  },
) {
  if (request.method === "OPTIONS") return emptyResponse(204);
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
  }

  const url = deps.supabaseUrl?.trim() ?? "";
  const key = deps.publishableKey?.trim() ?? "";
  if (!url || !key || isServiceRoleKey(key)) {
    return jsonResponse({ ok: false, message: emailNotConfiguredMessage }, 500);
  }
  const token = bearerToken(deps.authorization);
  if (!token) return jsonResponse({ ok: false, message: signedOutMessage }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: invalidRequestMessage });
  }
  const action = actionFromBody(body);
  if (!action.ok) return jsonResponse({ ok: false, message: invalidRequestMessage });

  const user = await deps.reader.userId();
  if (!user.ok) return jsonResponse({ ok: false, message: signedOutMessage }, 401);
  const profile = await deps.reader.profile(user.userId);
  if (!profile.ok) return jsonResponse({ ok: false, message: requestFailedMessage }, 500);
  if (profile.profile.role !== "student") {
    return jsonResponse({ ok: false, message: studentOnlyMessage }, 403);
  }

  if (action.action === "profile") {
    const result = await syncStudent({
      studentId: user.userId,
      email: profile.profile.email,
      fullName: profile.profile.fullName,
      enrollmentId: null,
      courseTitle: "",
      send: null,
      secrets: deps.secrets,
      fetchImpl: deps.fetchImpl,
      store: deps.reader,
    });
    return jsonResponse({ ok: true, emailed: result.emailed, synced: result.synced });
  }

  const enrollment = await deps.reader.enrollment(user.userId, action.courseId);
  if (!enrollment.ok) return jsonResponse({ ok: false, message: requestFailedMessage }, 500);
  if (!enrollment.enrollment) {
    return jsonResponse({ ok: false, message: courseUnavailableMessage });
  }
  const send =
    action.action === "completion"
      ? enrollment.enrollment.status === "completed"
        ? "certificate"
        : null
      : "enrolment";
  const result = await syncStudent({
    studentId: user.userId,
    email: profile.profile.email,
    fullName: profile.profile.fullName,
    enrollmentId: enrollment.enrollment.id,
    courseTitle: enrollment.enrollment.title,
    send,
    secrets: deps.secrets,
    fetchImpl: deps.fetchImpl,
    store: deps.reader,
  });
  return jsonResponse({ ok: true, emailed: result.emailed, synced: result.synced });
}

export async function handleResendWebhook(
  request: Request,
  deps: {
    webhookSecret: string | undefined;
    store: DeliveryStore | null;
    fetchImpl?: typeof fetch;
    nowMs?: number;
  },
) {
  if (request.method === "OPTIONS") return emptyResponse(204);
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
  }
  if (!deps.webhookSecret?.trim()) {
    return jsonResponse({ ok: false, message: emailNotConfiguredMessage }, 500);
  }

  const payload = await request.text();
  const valid = await verifySvixSignature({
    secret: deps.webhookSecret,
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
    payload,
    nowMs: deps.nowMs ?? Date.now(),
  });
  if (!valid) return jsonResponse({ ok: false, message: webhookSignatureMessage }, 400);
  if (!deps.store) return jsonResponse({ ok: false, message: emailNotConfiguredMessage }, 500);

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return jsonResponse({ ok: true, stored: false });
  }
  const delivery = deliveryFromPayload(parsed);
  const svixId = (request.headers.get("svix-id") ?? "").trim();
  if (!delivery || !svixId || svixId.length > 200) {
    return jsonResponse({ ok: true, stored: false });
  }

  const saved = await deps.store.record({
    eventKey: deliveryEventKey(svixId),
    status: delivery.type,
    providerEmailId: delivery.emailId,
  });
  if (!saved.ok) return jsonResponse({ ok: false, message: requestFailedMessage }, 500);
  return jsonResponse({ ok: true, stored: saved.stored });
}

export function bindStudentDb(client: EventWriteClient): StudentDb & {
  userId: (token: string) => Promise<{ ok: true; userId: string } | { ok: false }>;
} {
  return {
    async userId(token) {
      const auth = client.auth;
      if (!auth) return { ok: false };
      const result = await auth.getUser(token);
      const id = result.data.user?.id ?? "";
      if (result.error || !id) return { ok: false };
      return { ok: true, userId: id };
    },
    async profile(userId) {
      const result = await client
        .from("profiles")
        .select("email, full_name, role")
        .eq("id", userId)
        .maybeSingle();
      if (result.error || !result.data) return { ok: false };
      const role = textValue(result.data, "role");
      if (!role) return { ok: false };
      return {
        ok: true,
        profile: {
          email: textValue(result.data, "email"),
          fullName: textValue(result.data, "full_name"),
          role,
        },
      };
    },
    async enrollment(userId, courseId) {
      const enrollment = await client
        .from("enrollments")
        .select("id, status")
        .eq("student_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();
      if (enrollment.error) return { ok: false };
      const id = textValue(enrollment.data, "id");
      const status = textValue(enrollment.data, "status");
      if (!id || !status) return { ok: true, enrollment: null };
      const course = await client.from("courses").select("title").eq("id", courseId).maybeSingle();
      if (course.error) return { ok: false };
      return {
        ok: true,
        enrollment: { id, status, title: textValue(course.data, "title") || "this course" },
      };
    },
    claim(studentId, eventKey) {
      return claimEvent(client, studentId, eventKey);
    },
    markSent(id, providerEmailId) {
      return markEventSent(client, id, providerEmailId);
    },
    release(id) {
      return releaseEvent(client, id);
    },
  };
}

export function bindDeliveryStore(client: EventWriteClient): DeliveryStore {
  return {
    async record(input) {
      const result = await client
        .from("email_events")
        .upsert(
          {
            event_key: input.eventKey,
            student_id: null,
            kind: "delivery",
            status: input.status,
            provider_email_id: input.providerEmailId,
          },
          { onConflict: "event_key", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();
      if (result.error) return { ok: false };
      return { ok: true, stored: Boolean(rowId(result.data)) };
    },
  };
}

async function sendClaimedEmail(
  input: {
    studentId: string;
    email: string;
    enrollmentId: string;
    courseTitle: string;
    send: OutboundEmail;
    secrets: IntegrationSecrets;
    fetchImpl: typeof fetch;
  },
  store: OutboundStore,
) {
  const resendKey = input.secrets.resendKey?.trim() ?? "";
  const resendFrom = input.secrets.resendFrom?.trim() ?? "";
  if (!resendKey || !resendFrom) return false;
  const claimKey = emailClaimKey(input.send, input.enrollmentId);
  const claim = await store.claim(input.studentId, claimKey);
  if (!claim.ok || !claim.id) return false;

  const title = oneLine(input.courseTitle, "this course");
  const sent = await postJson(
    input.fetchImpl,
    resendEmailUrl,
    resendKey,
    {
      from: resendFrom,
      to: [input.email],
      subject: input.send === "enrolment" ? "You are enrolled" : "You completed a course",
      text:
        input.send === "enrolment" ? `You are enrolled in ${title}.` : `You completed ${title}.`,
    },
    claimKey,
  );
  if (!sent.ok) {
    if (sent.status !== 409) await store.release(claim.id);
    return false;
  }
  await store.markSent(claim.id, sent.id);
  return true;
}

async function upsertContact(
  email: string,
  fullName: string,
  hubspotToken: string | undefined,
  fetchImpl: typeof fetch,
) {
  const token = hubspotToken?.trim() ?? "";
  if (!token) return false;
  const response = await postJson(
    fetchImpl,
    hubspotUpsertUrl,
    token,
    hubspotContactBody(email, fullName),
  );
  if (!response.ok || !response.body) return false;
  return response.body["status"] === "COMPLETE" && !hasErrors(response.body);
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  key: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<
  | { ok: true; id: string; status: number; body: Record<string, unknown> | null }
  | { ok: false; status: number }
> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(integrationTimeoutMs),
    });
    const parsed = await readJson(response);
    const id = parsed && typeof parsed["id"] === "string" ? parsed["id"].trim() : "";
    if (!response.ok || (url === resendEmailUrl && !id))
      return { ok: false, status: response.status };
    return { ok: true, id, status: response.status, body: parsed };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function claimEvent(client: EventWriteClient, studentId: string, eventKey: string) {
  const result = await client
    .from("email_events")
    .upsert(
      {
        event_key: eventKey,
        student_id: studentId,
        kind: "outbound",
        status: "pending",
        provider_email_id: null,
      },
      { onConflict: "event_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (result.error) return { ok: false as const };
  return { ok: true as const, id: rowId(result.data) };
}

async function markEventSent(client: EventWriteClient, id: string, providerEmailId: string) {
  const result = await client
    .from("email_events")
    .update({ status: "sent", provider_email_id: providerEmailId })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (result.error || !rowId(result.data)) return { ok: false as const };
  return { ok: true as const };
}

async function releaseEvent(client: EventWriteClient, id: string) {
  try {
    await client
      .from("email_events")
      .delete()
      .eq("id", id)
      .eq("status", "pending")
      .is("provider_email_id", null)
      .select("id")
      .maybeSingle();
  } catch {
    return;
  }
}

function actionFromBody(
  body: unknown,
):
  | { ok: true; action: "profile" }
  | { ok: true; action: "enrolment" | "completion"; courseId: string }
  | { ok: false } {
  if (!body || typeof body !== "object" || !("action" in body)) return { ok: false };
  const action = body.action;
  if (action === "profile") return { ok: true, action };
  if (action !== "enrolment" && action !== "completion") return { ok: false };
  if (!("courseId" in body) || typeof body.courseId !== "string") return { ok: false };
  const courseId = body.courseId.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId)
  ) {
    return { ok: false };
  }
  return { ok: true, action, courseId };
}

function bearerToken(authorization: string | null) {
  const header = authorization?.trim() ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) return null;
  return token;
}

function isDeliveryEvent(value: string): value is DeliveryEventType {
  return (deliveryEventTypes as readonly string[]).includes(value);
}

function hasErrors(body: Record<string, unknown>) {
  if (typeof body["numErrors"] === "number" && body["numErrors"] > 0) return true;
  return Array.isArray(body["errors"]) && body["errors"].length > 0;
}

async function readJson(response: Response) {
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function oneLine(value: string, fallback: string) {
  const text = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  return text.slice(0, 180);
}

function textValue(data: Record<string, unknown> | null, key: string) {
  const value = data?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function rowId(data: Record<string, unknown> | null) {
  const id = data?.["id"];
  return typeof id === "string" && id ? id : null;
}

function decodeWebhookSecret(secret: string) {
  const trimmed = secret.trim();
  const encoded = trimmed.startsWith("whsec_") ? trimmed.slice("whsec_".length) : trimmed;
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function secretBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(left: string, right: string) {
  const encodedLeft = new TextEncoder().encode(left);
  const encodedRight = new TextEncoder().encode(right);
  const length = Math.max(encodedLeft.length, encodedRight.length);
  let mismatch = encodedLeft.length === encodedRight.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (encodedLeft[index] ?? 0) ^ (encodedRight[index] ?? 0);
  }
  return mismatch === 0;
}
