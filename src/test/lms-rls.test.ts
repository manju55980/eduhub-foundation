import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261009220000_create_lms_tables.sql"),
  "utf8",
);

const helpers = ["is_course_owner", "is_enrolled", "is_published_course"] as const;

function policyBodies(sql: string) {
  return [...sql.matchAll(/create policy [\s\S]*?;/g)].map((match) => match[0]);
}

describe("LMS row level security", () => {
  it("keeps course and enrollment lookups inside security-definer helpers", () => {
    const policies = policyBodies(migration);

    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy).not.toMatch(/from\s+public\.courses\b/);
      expect(policy).not.toMatch(/from\s+public\.enrollments\b/);
    }

    for (const name of helpers) {
      const body = migration.match(
        new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`),
      )?.[0];

      expect(body).toBeTruthy();
      expect(body).toMatch(/security definer/);
      expect(body).toMatch(/set search_path = ''/);
      expect(body).toMatch(/public\.(courses|enrollments)/);
      expect(migration).toContain(`revoke all on function public.${name}(uuid) from public, anon;`);
      expect(migration).toContain(
        `grant execute on function public.${name}(uuid) to authenticated;`,
      );
      expect(migration).not.toContain(`grant execute on function public.${name}(uuid) to anon;`);
      expect(migration).not.toContain(`grant execute on function public.${name}(uuid) to public;`);
    }
  });

  it("lets an instructor submit only a draft and an admin publish only a pending course", () => {
    expect(migration).toContain(
      "grant update (title, description, level, status) on table public.courses to authenticated;",
    );
    expect(migration).not.toMatch(/grant delete on table public\.courses/i);

    const guard = migration.match(
      /create or replace function public\.courses_guard_update\(\)[\s\S]*?\$\$;/,
    )?.[0];

    expect(guard).toBeTruthy();
    expect(guard).toContain("old.status = 'draft' and new.status = 'pending'");
    expect(guard).toContain("instructors can only submit a draft course for approval");
    expect(guard).toContain("old.status = 'pending' and new.status = 'published'");
    expect(guard).toContain("old.status = 'published' and new.status = 'archived'");
    expect(guard).toContain("admins can publish a pending course or archive a published course");
    expect(guard).toContain("admins can change only course status");
    expect(migration).toContain("and status = 'draft'");
  });
});

describe("instructor submission names", () => {
  const policyMigration = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20261010180000_profiles_select_instructor_submission.sql",
    ),
    "utf8",
  );

  it("lets an instructor read a submitter name only for a course they own", () => {
    expect(policyMigration).toContain("create policy profiles_select_instructor_submission");
    expect(policyMigration).toContain("public.current_app_role() = 'instructor'");
    expect(policyMigration).toContain("public.is_course_owner(assignment.course_id)");
    expect(policyMigration).toContain("submission.student_id = public.profiles.id");
    expect(policyMigration).not.toMatch(/from\s+public\.courses\b/);
    expect(policyMigration).not.toMatch(/from\s+public\.enrollments\b/);
    expect(policyMigration).not.toMatch(/create table/i);
    expect(policyMigration).not.toMatch(/add column/i);
    expect(policyMigration).not.toMatch(/grant /i);
  });
});
