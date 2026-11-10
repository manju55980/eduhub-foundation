import { createEmailProvider, type EmailProviderSecrets } from "./email-provider.ts";
import { jsonResponse, emptyResponse } from "./http.ts";
import {
  emailNotConfiguredMessage,
  invalidRequestMessage,
  requestFailedMessage,
  signedOutMessage,
} from "./student-integrations.ts";
import { isServiceRoleKey } from "./user-client.ts";

export const campaignAdminMessage = "Only an admin can use this.";
export const campaignSegments = ["new", "active", "inactive"] as const;
export type CampaignSegment = (typeof campaignSegments)[number];

const previewSampleLimit = 20;

export type CampaignAudienceRow = {
  student_id: string;
  email: string;
  full_name: string;
  segment: string;
};

export type CampaignSnapshotRow = {
  campaign_id: string;
  recipient_id: string | null;
  student_email: string | null;
  recipient_status: string;
  campaign_subject: string;
  campaign_body: string;
};

export type CampaignDb = {
  audience: (
    segment: CampaignSegment,
  ) => Promise<{ ok: true; rows: CampaignAudienceRow[] } | { ok: false; message: string }>;
  snapshot: (input: {
    segment: CampaignSegment;
    subject: string;
    body: string;
    idempotencyKey: string;
  }) => Promise<{ ok: true; rows: CampaignSnapshotRow[] } | { ok: false; message: string }>;
  markSent: (
    recipientId: string,
    providerEmailId: string,
  ) => Promise<{ ok: true; marked: boolean } | { ok: false }>;
  markFailed: (recipientId: string) => Promise<{ ok: true; marked: boolean } | { ok: false }>;
  finish: (campaignId: string) => Promise<{ ok: true; finished: boolean } | { ok: false }>;
};

export type CampaignRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export function bindCampaignDb(client: CampaignRpc): CampaignDb {
  return {
    async audience(segment) {
      const result = await client.rpc("campaign_audience", { target_segment: segment });
      if (result.error) return { ok: false, message: result.error.message };
      return { ok: true, rows: audienceRows(result.data) };
    },
    async snapshot(input) {
      const result = await client.rpc("create_campaign_snapshot", {
        target_segment: input.segment,
        requested_subject: input.subject,
        requested_body: input.body,
        idempotency_key: input.idempotencyKey,
      });
      if (result.error) return { ok: false, message: result.error.message };
      return { ok: true, rows: snapshotRows(result.data) };
    },
    async markSent(recipientId, providerEmailId) {
      const result = await client.rpc("mark_campaign_recipient_sent", {
        target_recipient: recipientId,
        provider_email_id: providerEmailId,
      });
      if (result.error) return { ok: false };
      return { ok: true, marked: result.data === true };
    },
    async markFailed(recipientId) {
      const result = await client.rpc("mark_campaign_recipient_failed", {
        target_recipient: recipientId,
      });
      if (result.error) return { ok: false };
      return { ok: true, marked: result.data === true };
    },
    async finish(campaignId) {
      const result = await client.rpc("finish_campaign", { target_campaign: campaignId });
      if (result.error) return { ok: false };
      return { ok: true, finished: result.data === true };
    },
  };
}

export async function handleAdminCampaign(
  request: Request,
  deps: {
    supabaseUrl: string | undefined;
    publishableKey: string | undefined;
    authorization: string | null;
    secrets: EmailProviderSecrets;
    fetchImpl: typeof fetch;
    db: CampaignDb;
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
  if (!bearerToken(deps.authorization)) {
    return jsonResponse({ ok: false, message: signedOutMessage }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: invalidRequestMessage });
  }
  const action = actionFromBody(body);
  if (!action.ok) return jsonResponse({ ok: false, message: invalidRequestMessage });

  if (action.action === "preview") {
    const audience = await deps.db.audience(action.segment);
    if (!audience.ok) return campaignError(audience.message);
    return jsonResponse({
      ok: true,
      segment: action.segment,
      count: audience.rows.length,
      sample: audience.rows.slice(0, previewSampleLimit).map((row) => ({
        fullName: row.full_name,
        email: row.email,
      })),
    });
  }

  const provider = createEmailProvider(deps.secrets, deps.fetchImpl);
  if (!provider) return jsonResponse({ ok: false, message: emailNotConfiguredMessage }, 500);

  const snapshot = await deps.db.snapshot({
    segment: action.segment,
    subject: action.subject,
    body: action.body,
    idempotencyKey: action.idempotencyKey,
  });
  if (!snapshot.ok) return campaignError(snapshot.message);
  const campaignId = snapshot.rows[0]?.campaign_id ?? "";
  const subject = snapshot.rows[0]?.campaign_subject ?? "";
  const text = snapshot.rows[0]?.campaign_body ?? "";
  if (!campaignId || !subject || !text) {
    return jsonResponse({ ok: false, message: requestFailedMessage }, 500);
  }

  let sent = 0;
  let failed = 0;
  let pending = 0;
  for (const row of snapshot.rows) {
    if (!row.recipient_id || row.recipient_status !== "pending" || !row.student_email) continue;
    const result = await provider.send({
      to: row.student_email,
      subject,
      text,
      idempotencyKey: `campaign:${row.recipient_id}`,
    });
    if (result.ok) {
      const marked = await deps.db.markSent(row.recipient_id, result.providerEmailId);
      if (!marked.ok) return jsonResponse({ ok: false, message: requestFailedMessage }, 500);
      if (marked.marked) sent += 1;
      else pending += 1;
      continue;
    }
    if (result.status === 409) {
      pending += 1;
      continue;
    }
    const marked = await deps.db.markFailed(row.recipient_id);
    if (!marked.ok) return jsonResponse({ ok: false, message: requestFailedMessage }, 500);
    if (marked.marked) failed += 1;
    else pending += 1;
  }

  if (pending === 0) {
    const finished = await deps.db.finish(campaignId);
    if (!finished.ok) return jsonResponse({ ok: false, message: requestFailedMessage }, 500);
  }

  return jsonResponse({ ok: true, campaignId, sent, failed, pending });
}

function campaignError(message: string) {
  if (message.toLowerCase().includes("only an admin")) {
    return jsonResponse({ ok: false, message: campaignAdminMessage }, 403);
  }
  if (
    message.toLowerCase().includes("not valid") ||
    message.toLowerCase().includes("already in use")
  ) {
    return jsonResponse({ ok: false, message: invalidRequestMessage });
  }
  return jsonResponse({ ok: false, message: requestFailedMessage }, 500);
}

function actionFromBody(body: unknown):
  | { ok: true; action: "preview"; segment: CampaignSegment }
  | {
      ok: true;
      action: "confirm";
      segment: CampaignSegment;
      subject: string;
      body: string;
      idempotencyKey: string;
    }
  | { ok: false } {
  if (!body || typeof body !== "object" || !("action" in body) || !("segment" in body)) {
    return { ok: false };
  }
  const segment = body.segment;
  if (!isSegment(segment)) return { ok: false };
  if (body.action === "preview") return { ok: true, action: "preview", segment };
  if (body.action !== "confirm") return { ok: false };
  if (!("subject" in body) || typeof body.subject !== "string") return { ok: false };
  if (!("body" in body) || typeof body.body !== "string") return { ok: false };
  if (!("idempotencyKey" in body) || typeof body.idempotencyKey !== "string") return { ok: false };
  const subject = body.subject.trim();
  const text = body.body.trim();
  const idempotencyKey = body.idempotencyKey.trim();
  if (
    subject.length < 1 ||
    subject.length > 180 ||
    text.length < 1 ||
    text.length > 4000 ||
    !/^[A-Za-z0-9-]{16,80}$/.test(idempotencyKey)
  ) {
    return { ok: false };
  }
  return { ok: true, action: "confirm", segment, subject, body: text, idempotencyKey };
}

function isSegment(value: unknown): value is CampaignSegment {
  return typeof value === "string" && (campaignSegments as readonly string[]).includes(value);
}

function bearerToken(authorization: string | null) {
  const header = authorization?.trim() ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) return null;
  return token;
}

function audienceRows(data: unknown): CampaignAudienceRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const record = recordOf(row);
    if (!record) return [];
    const studentId = textField(record, "student_id");
    const email = textField(record, "email");
    const segment = textField(record, "segment");
    if (!studentId || !email || !isSegment(segment)) return [];
    return [{ student_id: studentId, email, full_name: textField(record, "full_name"), segment }];
  });
}

function snapshotRows(data: unknown): CampaignSnapshotRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const record = recordOf(row);
    if (!record) return [];
    const campaignId = textField(record, "campaign_id");
    const status = textField(record, "recipient_status");
    const subject = textField(record, "campaign_subject");
    const body = textField(record, "campaign_body");
    if (!campaignId || !status || !subject || !body) return [];
    const recipientId = textField(record, "recipient_id");
    const email = textField(record, "student_email");
    return [
      {
        campaign_id: campaignId,
        recipient_id: recipientId || null,
        student_email: email || null,
        recipient_status: status,
        campaign_subject: subject,
        campaign_body: body,
      },
    ];
  });
}

function recordOf(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}
