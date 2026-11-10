import { describe, expect, it } from "vitest";

import { resendEmailUrl } from "../../../supabase/functions/_shared/email-provider.ts";
import {
  bindCampaignDb,
  campaignAdminMessage,
  handleAdminCampaign,
  type CampaignDb,
  type CampaignSnapshotRow,
} from "../../../supabase/functions/_shared/campaigns.ts";
import type { EmailProviderSecrets } from "../../../supabase/functions/_shared/email-provider.ts";

const fromAddress = "EduHub <notifications@example.com>";
const secrets: EmailProviderSecrets = {
  resendKey: "re_test",
  resendFrom: fromAddress,
};
const idempotencyKey = "11111111-1111-4111-8111-111111111111";

describe("admin campaign requests", () => {
  it("previews a segment without sending", async () => {
    const db = memoryDb();
    const calls: string[] = [];
    const response = await handleAdminCampaign(
      request({ action: "preview", segment: "inactive" }),
      {
        ...ready,
        db,
        fetchImpl: async (input) => {
          calls.push(String(input));
          return json({ id: "email-1" });
        },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      segment: "inactive",
      count: 1,
      sample: [{ fullName: "Ada Lovelace", email: "ada@example.com" }],
    });
    expect(db.snapshotted).toBe(0);
    expect(calls).toEqual([]);
  });

  it("rejects a student before previewing or sending", async () => {
    const db = memoryDb();
    db.audience = async () => ({ ok: false, message: "only an admin can view campaign segments" });
    const response = await handleAdminCampaign(request({ action: "preview", segment: "new" }), {
      ...ready,
      db,
      fetchImpl: async () => json({ id: "email-1" }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ message: campaignAdminMessage });
    expect(db.snapshotted).toBe(0);
  });

  it("sends the stored campaign once and skips a second confirm", async () => {
    const db = memoryDb();
    const bodies: unknown[] = [];
    const response = await handleAdminCampaign(
      request({
        action: "confirm",
        segment: "active",
        subject: "Changed after preview",
        body: "Changed after preview",
        idempotencyKey,
      }),
      {
        ...ready,
        db,
        fetchImpl: async (input, init) => {
          bodies.push(JSON.parse(String(init?.body)));
          expect(String(input)).toBe(resendEmailUrl);
          expect(new Headers(init?.headers).get("idempotency-key")).toBe("campaign:recipient-1");
          return json({ id: "email-1" });
        },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      campaignId: "campaign-1",
      sent: 1,
      failed: 0,
      pending: 0,
    });
    expect(bodies).toEqual([
      {
        from: fromAddress,
        to: ["ada@example.com"],
        subject: "Come back to class",
        text: "Your course is still open.",
      },
    ]);
    expect(db.sent).toEqual([{ id: "recipient-1", providerEmailId: "email-1" }]);
    expect(db.finished).toEqual(["campaign-1"]);

    const again = await handleAdminCampaign(
      request({
        action: "confirm",
        segment: "active",
        subject: "Come back to class",
        body: "Your course is still open.",
        idempotencyKey,
      }),
      {
        ...ready,
        db,
        fetchImpl: async () => json({ id: "email-2" }),
      },
    );
    expect(await again.json()).toMatchObject({ sent: 0, failed: 0, pending: 0 });
    expect(db.sent).toHaveLength(1);
  });

  it("does not snapshot a campaign when email is not configured", async () => {
    const db = memoryDb();
    const response = await handleAdminCampaign(
      request({
        action: "confirm",
        segment: "new",
        subject: "Welcome",
        body: "Welcome to EduHub.",
        idempotencyKey,
      }),
      {
        ...ready,
        secrets: {},
        db,
        fetchImpl: async () => json({ id: "email-1" }),
      },
    );
    expect(response.status).toBe(500);
    expect(db.snapshotted).toBe(0);
  });

  it("keeps a claim pending when Resend reports a concurrent send", async () => {
    const db = memoryDb();
    const response = await handleAdminCampaign(
      request({
        action: "confirm",
        segment: "new",
        subject: "Welcome",
        body: "Welcome to EduHub.",
        idempotencyKey,
      }),
      {
        ...ready,
        db,
        fetchImpl: async () => new Response("concurrent", { status: 409 }),
      },
    );
    expect(await response.json()).toMatchObject({ sent: 0, failed: 0, pending: 1 });
    expect(db.sent).toEqual([]);
    expect(db.failed).toEqual([]);
    expect(db.finished).toEqual([]);
  });

  it("stores a campaign with argument names that do not collide with the result", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const db = bindCampaignDb({
      async rpc(fn, args) {
        calls.push({ fn, args });
        return { data: [], error: null };
      },
    });
    await db.snapshot({
      segment: "inactive",
      subject: "Come back",
      body: "Your course is open.",
      idempotencyKey,
    });
    expect(calls).toEqual([
      {
        fn: "create_campaign_snapshot",
        args: {
          target_segment: "inactive",
          requested_subject: "Come back",
          requested_body: "Your course is open.",
          idempotency_key: idempotencyKey,
        },
      },
    ]);
  });
});

const ready = {
  supabaseUrl: "http://localhost:54321",
  publishableKey: "sb_publishable_test",
  authorization: "Bearer a.b.c",
  secrets,
};

function request(body: unknown) {
  return new Request("http://localhost/admin-campaign", {
    method: "POST",
    headers: { Authorization: "Bearer a.b.c" },
    body: JSON.stringify(body),
  });
}

function memoryDb(): CampaignDb & {
  snapshotted: number;
  sent: Array<{ id: string; providerEmailId: string }>;
  failed: string[];
  finished: string[];
} {
  let pending = true;
  const sent: Array<{ id: string; providerEmailId: string }> = [];
  const failed: string[] = [];
  const finished: string[] = [];
  const db: CampaignDb & {
    snapshotted: number;
    sent: Array<{ id: string; providerEmailId: string }>;
    failed: string[];
    finished: string[];
  } = {
    snapshotted: 0,
    sent,
    failed,
    finished,
    async audience() {
      return {
        ok: true,
        rows: [
          {
            student_id: "student-1",
            email: "ada@example.com",
            full_name: "Ada Lovelace",
            segment: "inactive",
          },
        ],
      };
    },
    async snapshot() {
      db.snapshotted += 1;
      const row: CampaignSnapshotRow = pending
        ? {
            campaign_id: "campaign-1",
            recipient_id: "recipient-1",
            student_email: "ada@example.com",
            recipient_status: "pending",
            campaign_subject: "Come back to class",
            campaign_body: "Your course is still open.",
          }
        : {
            campaign_id: "campaign-1",
            recipient_id: null,
            student_email: null,
            recipient_status: "sent",
            campaign_subject: "Come back to class",
            campaign_body: "Your course is still open.",
          };
      return { ok: true, rows: [row] };
    },
    async markSent(id, providerEmailId) {
      pending = false;
      sent.push({ id, providerEmailId });
      return { ok: true, marked: true };
    },
    async markFailed(id) {
      pending = false;
      failed.push(id);
      return { ok: true, marked: true };
    },
    async finish(campaignId) {
      finished.push(campaignId);
      return { ok: true, finished: true };
    },
  };
  return db;
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
