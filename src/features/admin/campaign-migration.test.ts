import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261104140000_campaigns.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const snapshotFix = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261106170000_fix_campaign_snapshot_conflict.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

function functionBody(name: string, source = migration) {
  const body = source.match(
    new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`),
  )?.[0];
  expect(body, name).toBeTruthy();
  return body ?? "";
}

describe("campaign migration", () => {
  const audience = functionBody("campaign_audience\\(target_segment text\\)");
  const snapshot = functionBody(
    "create_campaign_snapshot\\(\\s*target_segment text,[\\s\\S]*?idempotency_key text\\s*\\)",
  );
  const delivery = functionBody(
    "apply_campaign_delivery\\(\\s*provider_email_id text,[\\s\\S]*?suppress_email text\\s*\\)",
  );
  const reenrolment = functionBody("mark_campaign_reenrolment\\(\\)");

  it("classifies each student once, New before Active before Inactive", () => {
    expect(audience).toContain("security definer");
    expect(audience).toContain("set search_path = ''");
    expect(audience).toContain("only an admin can view campaign segments");
    expect(audience).toContain("profile.role = 'student'");
    expect(audience).toContain("nullif(pg_catalog.btrim(profile.email), '') is not null");
    expect(audience).toContain("public.email_suppressions");
    expect(audience).toContain("public.enrollments");
    expect(audience).toContain("public.lesson_completions");
    expect(audience).toContain("public.submissions");
    const rule = audience.slice(audience.indexOf("case"), audience.indexOf("end as segment"));
    expect(rule.indexOf("interval '7 days' then 'new'")).toBeGreaterThan(-1);
    expect(rule.indexOf("interval '7 days' then 'new'")).toBeLessThan(
      rule.indexOf("interval '30 days' then 'active'"),
    );
    expect(rule.indexOf("interval '30 days' then 'active'")).toBeLessThan(
      rule.indexOf("else 'inactive'"),
    );
    expect(migration).toContain(
      "grant execute on function public.campaign_audience(text) to authenticated;",
    );
    expect(migration).not.toContain(
      "grant execute on function public.campaign_audience(text) to anon;",
    );
  });

  it("snapshots one recipient per student and lets an admin finish the send", () => {
    const signature = snapshot.slice(0, snapshot.indexOf("returns table"));
    expect(signature).toContain("requested_subject text");
    expect(signature).toContain("requested_body text");
    expect(signature).not.toContain("campaign_subject");
    expect(signature).not.toContain("campaign_body");
    expect(snapshot).toContain("clean_subject is null");
    expect(snapshot).toContain("only an admin can send a campaign");
    expect(snapshot).toContain("on conflict (idempotency_key) do nothing");
    expect(snapshot).toContain("this campaign key is already in use");
    expect(snapshot).toContain("recipient.status = 'pending'");
    expect(snapshot).toContain("existing_subject");
    expect(snapshot).toContain("existing_body");
    expect(migration).toContain(
      "create unique index campaign_recipients_campaign_student_uidx\n  on public.campaign_recipients (campaign_id, student_id);",
    );
    expect(migration).toContain(
      "constraint campaigns_idempotency_key_key unique (idempotency_key)",
    );
    expect(functionBody("mark_campaign_recipient_sent\\([\\s\\S]*?\\)")).toContain(
      "recipient.status = 'pending'",
    );
    expect(functionBody("finish_campaign\\(target_campaign uuid\\)")).toContain(
      "recipient.status = 'pending'",
    );
    expect(migration).toContain(
      "grant execute on function public.create_campaign_snapshot(text, text, text, text) to authenticated;",
    );
  });

  it("keeps campaign writes off the signed-in role and limits delivery updates to the webhook", () => {
    expect(migration).not.toMatch(/grant insert on table public\.campaigns/i);
    expect(migration).not.toMatch(/grant update on table public\.campaigns/i);
    expect(migration).not.toMatch(/grant delete on table public\.campaigns/i);
    expect(migration).not.toMatch(/grant insert on table public\.campaign_recipients/i);
    expect(migration).not.toMatch(/grant update on table public\.campaign_recipients/i);
    expect(migration).not.toMatch(/grant insert on table public\.email_suppressions/i);
    expect(migration).toContain("using (public.current_app_role() = 'admin')");
    expect(delivery).toContain("auth.role()");
    expect(delivery).toContain("service_role");
    expect(delivery).toContain("next_status = 'opened' and recipient.status = 'sent'");
    expect(delivery).toContain("next_status = 'bounced' and recipient.status = 'sent'");
    expect(delivery).toContain("on conflict (email) do nothing");
    expect(migration).toContain(
      "grant execute on function public.apply_campaign_delivery(text, text, text, text) to service_role;",
    );
    expect(migration).toContain(
      "revoke all on function public.apply_campaign_delivery(text, text, text, text) from public, anon, authenticated;",
    );
  });

  it("records a later enrolment without a second row in the same course", () => {
    expect(reenrolment).toContain("security definer");
    expect(reenrolment).toContain("set search_path = ''");
    expect(reenrolment).toContain("recipient.sent_at < new.created_at");
    expect(reenrolment).toContain("recipient.reenrolled_at is null");
    expect(reenrolment).toContain("recipient.status in ('sent', 'opened', 'bounced')");
    expect(migration).toContain("after insert on public.enrollments");
    expect(migration).toContain(
      "revoke all on function public.mark_campaign_reenrolment() from public, anon, authenticated;",
    );
  });
});

describe("campaign snapshot conflict fix", () => {
  const signature =
    "create_campaign_snapshot\\(\\s*target_segment text,[\\s\\S]*?idempotency_key text\\s*\\)";

  it("names the unique constraint and keeps duplicate keys on the original campaign", () => {
    const fixed = functionBody(signature, snapshotFix);
    const original = functionBody(signature);
    expect(fixed).toContain("on conflict on constraint campaigns_idempotency_key_key do nothing");
    expect(fixed).not.toContain("on conflict (idempotency_key)");
    expect(fixed.replace(/\s+/g, " ")).toBe(
      original
        .replace(
          "on conflict (idempotency_key) do nothing",
          "on conflict on constraint campaigns_idempotency_key_key do nothing",
        )
        .replace(/\s+/g, " "),
    );
    expect(fixed).toContain("this campaign key is already in use");
    expect(fixed).toContain("recipient.status = 'pending'");
    expect(fixed).toContain("existing_subject");
    expect(fixed).toContain("existing_body");
    expect(snapshotFix).toContain(
      "revoke all on function public.create_campaign_snapshot(text, text, text, text) from public, anon;",
    );
    expect(snapshotFix).toContain(
      "grant execute on function public.create_campaign_snapshot(text, text, text, text) to authenticated;",
    );
    expect(snapshotFix).not.toContain(
      "grant execute on function public.create_campaign_snapshot(text, text, text, text) to anon;",
    );
  });
});
