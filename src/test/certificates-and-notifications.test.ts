import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261016221000_certificates_and_notifications.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

function policyBodies(sql: string) {
  return [...sql.matchAll(/create policy [\s\S]*?;/g)].map((match) => match[0]);
}

function functionBody(name: string) {
  const body = migration.match(
    new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`),
  )?.[0];
  expect(body).toBeTruthy();
  return body ?? "";
}

describe("certificates and notifications migration", () => {
  const policies = policyBodies(migration);
  const issue = functionBody("enrollments_issue_certificate\\(\\)");
  const guard = functionBody("notifications_guard_update\\(\\)");

  it("stores one certificate per enrollment and one notification per dedupe key", () => {
    expect(migration).toContain("create table public.certificates");
    expect(migration).toContain("enrollment_id uuid not null references public.enrollments (id)");
    expect(migration).toContain("issued_at timestamptz not null default now()");
    expect(migration).toContain(
      "create unique index certificates_enrollment_id_uidx\n  on public.certificates (enrollment_id);",
    );
    expect(migration).toContain("create table public.notifications");
    expect(migration).toContain(
      "kind in ('course_completed', 'student_completed_course', 'assignment_due')",
    );
    expect(migration).toContain(
      "create unique index notifications_dedupe_key_uidx\n  on public.notifications (dedupe_key);",
    );
    expect(migration).toContain("grant select on table public.certificates to authenticated");
    expect(migration).toContain("grant select on table public.notifications to authenticated");
    expect(migration).toContain(
      "grant update (read_at) on table public.notifications to authenticated",
    );
    expect(migration).not.toMatch(/grant insert on table public\.certificates/i);
    expect(migration).not.toMatch(/grant update on table public\.certificates/i);
    expect(migration).not.toMatch(/grant delete on table public\.certificates/i);
    expect(migration).not.toMatch(/grant insert on table public\.notifications/i);
    expect(migration).not.toMatch(/grant delete on table public\.notifications/i);
    expect(migration).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  });

  it("lets the owner read a certificate and only the recipient update read_at", () => {
    expect(policies).toHaveLength(3);
    for (const policy of policies) {
      expect(policy).not.toMatch(/from\s+public\.courses\b/);
      expect(policy).not.toMatch(/from\s+public\.enrollments\b/);
      expect(policy).not.toMatch(/from\s+public\.profiles\b/);
    }

    expect(migration).toContain("public.is_course_owner(course_id)");
    expect(migration).toContain("student_id = (select auth.uid())");
    expect(migration).toContain("recipient_id = (select auth.uid())");
    expect(guard).toMatch(/security definer/);
    expect(guard).toMatch(/set search_path = ''/);
    expect(guard).toContain("only the recipient can mark a notification read");
    expect(guard).toContain("a notification update can change only read_at");
    expect(guard).toContain("read_at cannot be cleared");
    expect(migration).toContain(
      "before update on public.notifications\n  for each row execute function public.notifications_guard_update();",
    );
  });

  it("issues one certificate and two notifications only on the first completion", () => {
    expect(issue).toMatch(/security definer/);
    expect(issue).toMatch(/set search_path = ''/);
    expect(issue).toContain("'Course complete'");
    expect(issue).toContain("'A student completed a course'");
    expect(issue).toContain("'course_completed:' || new.id::text");
    expect(issue).toContain("'student_completed_course:' || new.id::text");
    expect(issue).toContain("on conflict (enrollment_id) do nothing");
    expect(issue.match(/on conflict \(dedupe_key\) do nothing/g)).toHaveLength(2);
    expect(issue).not.toMatch(/email|phone|full_name|public\.profiles/);
    expect(migration).toContain(
      "after update on public.enrollments\n  for each row\n  when (old.status is distinct from new.status and new.status = 'completed')\n  execute function public.enrollments_issue_certificate();",
    );
    expect(migration).not.toMatch(/create or replace function public\.enrollments_sync_status/);
    expect(migration).not.toMatch(/create policy enrollments_/);
  });
});
