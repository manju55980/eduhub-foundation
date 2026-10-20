import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261016220000_lesson_completions.sql"),
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

describe("lesson completion migration", () => {
  const policies = policyBodies(migration);
  const lookup = functionBody("lesson_course_id\\(target_lesson_id uuid\\)");
  const sync = functionBody("sync_enrollment_progress\\([\\s\\S]*?\\)");

  it("stores one completion per student and lesson", () => {
    expect(migration).toContain("create table public.lesson_completions");
    expect(migration).toContain("student_id uuid not null references public.profiles (id)");
    expect(migration).toContain("lesson_id uuid not null references public.lessons (id)");
    expect(migration).toContain("created_at timestamptz not null default now()");
    expect(migration).toContain(
      "create unique index lesson_completions_student_lesson_uidx\n  on public.lesson_completions (student_id, lesson_id);",
    );
    expect(migration).toContain("grant select on table public.lesson_completions to authenticated");
    expect(migration).toContain(
      "grant insert (student_id, lesson_id) on table public.lesson_completions to authenticated",
    );
    expect(migration).not.toMatch(/grant update on table public\.lesson_completions/i);
    expect(migration).not.toMatch(/grant delete on table public\.lesson_completions/i);
    expect(migration).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  });

  it("keeps lesson lookup out of the policies", () => {
    expect(policies).toHaveLength(2);
    for (const policy of policies) {
      expect(policy).not.toMatch(/from\s+public\.lessons\b/);
      expect(policy).not.toMatch(/from\s+public\.courses\b/);
      expect(policy).not.toMatch(/from\s+public\.enrollments\b/);
    }

    expect(lookup).toMatch(/security definer/);
    expect(lookup).toMatch(/set search_path = ''/);
    expect(lookup).toContain("from public.lessons");
    expect(migration).toContain(
      "grant execute on function public.lesson_course_id(uuid) to authenticated",
    );
    expect(migration).not.toContain(
      "grant execute on function public.lesson_course_id(uuid) to anon",
    );
    expect(migration).toContain("public.is_enrolled(public.lesson_course_id(lesson_id))");
    expect(migration).toContain("public.is_course_owner(public.lesson_course_id(lesson_id))");
    expect(migration).toContain("public.current_app_role() = 'student'");
    expect(migration).toContain("student_id = (select auth.uid())");
  });

  it("recalculates progress from lesson completions without changing existing enrollment rules", () => {
    expect(sync).toMatch(/security definer/);
    expect(sync).toMatch(/set search_path = ''/);
    expect(sync).toContain("next_progress := 0");
    expect(sync).toContain("floor(completed_count * 100.0 / lesson_count)::integer");
    expect(sync).toContain("set progress = next_progress");
    expect(sync).not.toMatch(/set\s+status/i);
    expect(migration).toContain(
      "revoke all on function public.sync_enrollment_progress(uuid, uuid) from public, anon, authenticated",
    );
    expect(migration).not.toContain(
      "grant execute on function public.sync_enrollment_progress(uuid, uuid)",
    );
    expect(migration).toContain(
      "after insert on public.lesson_completions\n  for each row execute function public.lesson_completions_sync_progress();",
    );
    expect(migration).toContain(
      "after insert on public.lessons\n  for each row execute function public.lessons_sync_enrollment_progress();",
    );
    expect(migration).not.toMatch(/create policy enrollments_/);
    expect(migration).not.toMatch(/create or replace function public\.enrollments_sync_status/);
  });
});
