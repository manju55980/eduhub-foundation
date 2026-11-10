import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const migration = readMigration("20261102220000_email_events.sql");
const normalized = readMigration("20261104130000_normalize_email_delivery_events.sql");

describe("email events migration", () => {
  it("dedupes outbound claims and delivery events with one unique key", () => {
    expect(migration).toContain("create table public.email_events");
    expect(migration).toContain(
      "create unique index email_events_event_key_uidx\n  on public.email_events (event_key);",
    );
    expect(migration).toContain("kind = 'outbound'");
    expect(migration).toContain("kind = 'delivery'");
    expect(migration).toContain("'email.delivered'");
    expect(migration).toContain("'email.bounced'");
    expect(migration).toContain("'email.complained'");
  });

  it("lets a student claim only their own enrolment or certificate key", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("claim_key = 'enrolment:' || enrollment.id::text");
    expect(migration).toContain("claim_key = 'certificate:' || enrollment.id::text");
    expect(migration).toContain("enrollment.status = 'completed'");
    expect(migration).toContain("public.owns_email_claim(event_key, student_id)");
    expect(migration).toContain("status = 'pending'");
    expect(migration).toContain("provider_email_id is null");
    expect(migration).toContain(
      "grant update (status, provider_email_id) on table public.email_events to authenticated;",
    );
    expect(migration).toContain(
      "grant select, insert on table public.email_events to service_role;",
    );
    expect(migration).not.toContain("grant update on table public.email_events to service_role");
    expect(migration).not.toContain("grant delete on table public.email_events to service_role");
  });
});

describe("normalized delivery migration", () => {
  it("replaces Resend delivery statuses with the shared event names", () => {
    expect(normalized).toContain("when 'email.sent' then 'sent'");
    expect(normalized).toContain("when 'email.delivered' then 'delivered'");
    expect(normalized).toContain("when 'email.bounced' then 'bounced'");
    expect(normalized).toContain("when 'email.complained' then 'failed'");
    expect(normalized).toContain("status in ('sent', 'delivered', 'opened', 'bounced', 'failed')");
    expect(normalized).toContain("drop constraint email_events_kind_status_check");
    expect(normalized).toContain("'delivery:resend:'");
    expect(normalized).toContain("event_key not like 'delivery:smtp2go:%'");
    expect(normalized).not.toContain("grant ");
  });
});
