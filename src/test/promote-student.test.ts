import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261010230000_promote_student_to_instructor.sql"),
  "utf8",
);
const usersApi = readFileSync(resolve(process.cwd(), "src/features/admin/users-api.ts"), "utf8");

function functionBody(name: string) {
  const body = migration.match(
    new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`),
  )?.[0];
  expect(body).toBeTruthy();
  return body ?? "";
}

describe("promote_student_to_instructor", () => {
  const promote = functionBody("promote_student_to_instructor\\(target_id uuid\\)");

  it("promotes a student to instructor and changes no other column", () => {
    expect(promote).toMatch(/security definer/);
    expect(promote).toMatch(/set search_path = ''/);
    expect(promote).toContain("set role = 'instructor'");
    expect(promote).toContain("and role = 'student'");
    expect(promote).not.toMatch(/set\s+(full_name|email|phone|id|created_at)/);
    expect(migration).toContain(
      "grant execute on function public.promote_student_to_instructor(uuid) to authenticated;",
    );
    expect(migration).toContain(
      "revoke all on function public.promote_student_to_instructor(uuid) from public, anon;",
    );
    expect(migration).not.toMatch(/grant update \(role\)/i);
    expect(migration).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY/i);
    expect(usersApi).not.toMatch(
      /service_role|serviceRole|SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin/,
    );
    expect(usersApi).toContain('supabase.rpc("promote_student_to_instructor"');
  });

  it("rejects a caller who is not an admin", () => {
    expect(promote).toContain("public.current_app_role() is distinct from 'admin'");
    expect(promote).toContain("only an admin can promote a student");
  });

  it("rejects self-promotion", () => {
    expect(promote).toContain("target_id is not distinct from (select auth.uid())");
    expect(promote).toContain("an admin cannot change their own role");
  });

  it("rejects a target who is not a student", () => {
    expect(promote).toContain("only a student can be promoted to instructor");
  });

  it("rejects a repeated promotion", () => {
    expect(promote).toContain("and role = 'instructor'");
    expect(promote).toContain("this user is already an instructor");
  });
});

describe("prevent_profile_role_change", () => {
  const trigger = functionBody("prevent_profile_role_change\\(\\)");

  it("allows only another student's promotion from a signed-in admin", () => {
    expect(trigger).toContain("if auth.uid() is null then");
    expect(trigger).toContain("public.current_app_role() = 'admin'");
    expect(trigger).toContain("old.id is distinct from (select auth.uid())");
    expect(trigger).toContain("old.role = 'student'");
    expect(trigger).toContain("new.role = 'instructor'");
    expect(trigger).toContain("new.full_name is not distinct from old.full_name");
    expect(trigger).toContain("new.email is not distinct from old.email");
    expect(trigger).toContain("new.phone is not distinct from old.phone");
    expect(trigger).toContain("profile role cannot be changed from a signed-in session");
    expect(migration).not.toMatch(/create table/i);
    expect(migration).not.toMatch(/add column/i);
  });
});
