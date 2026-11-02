import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261102000000_assessment3_course_materials_and_review.sql",
  ),
  "utf8",
);

function functionBody(name: string) {
  const body = migration.match(
    new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`),
  )?.[0];
  expect(body).toBeTruthy();
  return body ?? "";
}

function policyBodies(sql: string) {
  return [...sql.matchAll(/create policy [\s\S]*?;/g)].map((match) => match[0]);
}

describe("course materials migration", () => {
  const policies = policyBodies(migration);
  const guard = functionBody("courses_guard_update\\(\\)");
  const draft = functionBody("is_draft_course\\(target_course_id uuid\\)");

  it("freezes instructor course fields, lessons, and assignments after draft", () => {
    expect(draft).toMatch(/security definer/);
    expect(draft).toMatch(/set search_path = ''/);
    expect(draft).toContain("status = 'draft'");
    expect(migration).toContain(
      "grant execute on function public.is_draft_course(uuid) to authenticated;",
    );
    expect(migration).not.toContain(
      "grant execute on function public.is_draft_course(uuid) to anon;",
    );
    expect(guard).toContain(
      "instructors can change course fields only while the course is a draft",
    );
    expect(guard).toContain("new.category_id is distinct from old.category_id");
    expect(guard).toContain("old.status = 'draft' and new.status = 'pending'");
    expect(guard).toContain("old.status = 'pending' and new.status = 'published'");
    expect(guard).toContain("old.status = 'published' and new.status = 'archived'");
    expect(guard).toContain("admins can change only course status");

    for (const name of [
      "lessons_insert_instructor",
      "lessons_update_instructor",
      "assignments_write_instructor",
      "assignments_update_instructor",
    ]) {
      const policy = policies.find((item) => item.includes(`create policy ${name}`));
      expect(policy).toContain("public.is_draft_course(course_id)");
      expect(policy).toContain("public.is_course_owner(course_id)");
    }
  });

  it("stores private course materials and does not grant update or delete", () => {
    expect(migration).toContain("insert into storage.buckets");
    expect(migration).toContain("'course-materials'");
    expect(migration).toContain("20971520");
    expect(migration).toContain("'application/pdf'");
    expect(migration).toContain("'image/jpeg'");
    expect(migration).toContain("create table public.course_materials");
    expect(migration).not.toContain("lesson_id");
    expect(migration).toContain("byte_size >= 1 and byte_size <= 20971520");
    expect(migration).toContain(
      "new.storage_path := new.course_id::text || '/' || new.id::text || '/' || new.file_name",
    );
    expect(migration).toContain("grant insert (course_id, file_name, mime_type, byte_size)");
    expect(migration).not.toMatch(/grant update on table public\.course_materials/i);
    expect(migration).not.toMatch(/grant delete on table public\.course_materials/i);
    expect(migration).not.toMatch(/on storage\.objects\s+for update/i);
    expect(migration).not.toMatch(/on storage\.objects\s+for delete/i);
    expect(migration).not.toMatch(/content_url|video_url/);
    expect(migration).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY/i);

    for (const policy of policies) {
      expect(policy).not.toMatch(/from\s+public\.courses\b/);
      expect(policy).not.toMatch(/from\s+public\.enrollments\b/);
    }

    const materialSelect = policies.find((policy) =>
      policy.includes("create policy course_materials_select"),
    );
    const objectInsert = policies.find((policy) =>
      policy.includes("create policy course_materials_objects_insert"),
    );
    expect(materialSelect).toContain("public.current_app_role() = 'admin'");
    expect(materialSelect).toContain("public.is_course_owner(course_id)");
    expect(materialSelect).toContain("public.is_enrolled(course_id)");
    expect(objectInsert).toContain("public.is_draft_course(public.storage_course_id(name))");
    expect(functionBody("storage_course_id\\(object_name text\\)")).toMatch(/security definer/);
    expect(migration).toMatch(/values \(\s*'course-materials',\s*'course-materials',\s*false,/);
  });

  it("keeps course review rows advisory and admin-only", () => {
    expect(migration).toContain("create table public.course_reviews");
    expect(migration).toContain("recommendation in ('recommend', 'revise')");
    expect(migration).toContain("confidence >= 0 and confidence <= 1");
    expect(migration).not.toMatch(/grant update on table public\.course_reviews/i);
    expect(migration).not.toMatch(/grant delete on table public\.course_reviews/i);
    const insert = policies.find((policy) =>
      policy.includes("create policy course_reviews_insert_admin"),
    );
    expect(insert).toContain("public.current_app_role() = 'admin'");
    expect(insert).toContain("public.is_pending_course(course_id)");
  });
});
