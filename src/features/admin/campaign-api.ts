import { supabase } from "@/integrations/supabase/client";

export const campaignSegments = ["new", "active", "inactive"] as const;
export type CampaignSegment = (typeof campaignSegments)[number];

export type CampaignSample = { fullName: string; email: string };

export type CampaignPreview = {
  segment: CampaignSegment;
  count: number;
  sample: CampaignSample[];
};

export type CampaignSend = {
  campaignId: string;
  sent: number;
  failed: number;
  pending: number;
};

export type CampaignSummary = {
  id: string;
  segment: string;
  subject: string;
  status: string;
  createdAt: string;
  sent: number;
  opened: number;
  bounced: number;
  reenrolled: number;
};

const failedMessage = "The campaign request could not be completed.";

export async function previewCampaign(segment: CampaignSegment) {
  const { data, error } = await supabase.functions.invoke("admin-campaign", {
    body: { action: "preview", segment },
  });
  const result = await readCampaignResult(data, error);
  if (!result.ok) return result;
  const count = numberField(result.value, "count");
  const sample = sampleField(result.value);
  if (count === null || !sample) return { ok: false as const, message: failedMessage };
  return { ok: true as const, preview: { segment, count, sample } };
}

export async function confirmCampaign(input: {
  segment: CampaignSegment;
  subject: string;
  body: string;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.functions.invoke("admin-campaign", {
    body: { action: "confirm", ...input },
  });
  const result = await readCampaignResult(data, error);
  if (!result.ok) return result;
  const campaignId = textField(result.value, "campaignId");
  const sent = numberField(result.value, "sent");
  const failed = numberField(result.value, "failed");
  const pending = numberField(result.value, "pending");
  if (!campaignId || sent === null || failed === null || pending === null) {
    return { ok: false as const, message: failedMessage };
  }
  return { ok: true as const, send: { campaignId, sent, failed, pending } };
}

export async function listCampaigns() {
  const campaigns = await supabase
    .from("campaigns")
    .select("id, segment, subject, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (campaigns.error) return { ok: false as const, message: campaigns.error.message };
  const rows = campaigns.data ?? [];
  if (rows.length === 0) return { ok: true as const, campaigns: [] as CampaignSummary[] };

  const recipients = await supabase
    .from("campaign_recipients")
    .select("campaign_id, status, reenrolled_at")
    .in(
      "campaign_id",
      rows.map((row) => row.id),
    );
  if (recipients.error) return { ok: false as const, message: recipients.error.message };

  return {
    ok: true as const,
    campaigns: rows.map((row) => {
      const matches = (recipients.data ?? []).filter((item) => item.campaign_id === row.id);
      return {
        id: row.id,
        segment: row.segment,
        subject: row.subject,
        status: row.status,
        createdAt: row.created_at,
        sent: matches.filter(
          (item) => item.status === "sent" || item.status === "opened" || item.status === "bounced",
        ).length,
        opened: matches.filter((item) => item.status === "opened").length,
        bounced: matches.filter((item) => item.status === "bounced").length,
        reenrolled: matches.filter((item) => item.reenrolled_at).length,
      };
    }),
  };
}

async function readCampaignResult(
  data: unknown,
  error: { message: string; context?: unknown } | null,
) {
  if (error) {
    const context = error.context;
    if (context instanceof Response) {
      try {
        const body: unknown = await context.clone().json();
        const message = textField(body, "message");
        if (message) return { ok: false as const, message };
      } catch {
        return { ok: false as const, message: failedMessage };
      }
    }
    return { ok: false as const, message: error.message.trim() || failedMessage };
  }
  if (!data || typeof data !== "object" || !("ok" in data)) {
    return { ok: false as const, message: failedMessage };
  }
  if (data.ok === false) {
    return { ok: false as const, message: textField(data, "message") || failedMessage };
  }
  return { ok: true as const, value: data };
}

function sampleField(value: unknown) {
  if (!value || typeof value !== "object" || !("sample" in value) || !Array.isArray(value.sample)) {
    return null;
  }
  return value.sample.flatMap((item) => {
    const fullName = textField(item, "fullName");
    const email = textField(item, "email");
    return email ? [{ fullName, email }] : [];
  });
}

function numberField(value: unknown, key: string) {
  const record = recordOf(value);
  if (!record || !(key in record)) return null;
  const field = record[key];
  return typeof field === "number" ? field : null;
}

function textField(value: unknown, key: string) {
  const record = recordOf(value);
  if (!record || !(key in record)) return "";
  const field = record[key];
  return typeof field === "string" ? field.trim() : "";
}

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
