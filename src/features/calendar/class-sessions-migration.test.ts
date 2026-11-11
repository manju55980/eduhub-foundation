import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261111120000_class_sessions.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

function policyBodies(sql: string) {
  return [...sql.matchAll(/create policy [\s\S]*?;/g)].map((match) => match[0]);
}

describe("class sessions migration", () => {
  const policies = policyBodies(migration);

  it("requires a meeting to end after it starts and keeps a title", () => {
    expect(migration).toContain("create table public.class_sessions");
    expect(migration).toContain("references public.courses (id) on delete restrict");
    expect(migration).toContain(
      "constraint class_sessions_ends_after_start check (ends_at > starts_at)",
    );
    expect(migration).toContain(
      "constraint class_sessions_title_not_blank check (char_length(btrim(title)) > 0)",
    );
    expect(migration).toContain("starts_at timestamptz not null");
    expect(migration).toContain("ends_at timestamptz not null");
    expect(migration).not.toMatch(/grant delete on table public\.class_sessions/i);
    expect(migration).not.toMatch(/service_role/i);
  });

  it("lets an owner instructor write and an enrolled student read", () => {
    expect(policies).toHaveLength(3);
    for (const policy of policies) {
      expect(policy).not.toMatch(/from\s+public\.courses\b/);
      expect(policy).not.toMatch(/from\s+public\.enrollments\b/);
      expect(policy).not.toContain("public.current_app_role()");
      expect(policy).not.toContain("'admin'");
    }

    const select = policies.find((policy) =>
      policy.includes("create policy class_sessions_select"),
    );
    const insert = policies.find((policy) =>
      policy.includes("create policy class_sessions_insert_instructor"),
    );
    const update = policies.find((policy) =>
      policy.includes("create policy class_sessions_update_instructor"),
    );

    expect(select).toContain("private.current_app_role() = 'instructor'");
    expect(select).toContain("private.is_course_owner(course_id)");
    expect(select).toContain("private.current_app_role() = 'student'");
    expect(select).toContain("private.is_enrolled(course_id)");
    expect(insert).toContain("for insert");
    expect(insert).toContain("private.is_course_owner(course_id)");
    expect(update).toContain("for update");
    expect(update).toContain("private.is_course_owner(course_id)");
    expect(migration).toContain(
      "grant update (title, starts_at, ends_at, location) on table public.class_sessions to authenticated;",
    );
    expect(migration).not.toContain("grant update (course_id");
  });
});
