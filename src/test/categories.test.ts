import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261010233000_create_categories.sql"),
  "utf8",
);
const categoriesApi = readFileSync(
  resolve(process.cwd(), "src/features/admin/categories-api.ts"),
  "utf8",
);

function functionBody(name: string) {
  const body = migration.match(
    new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`),
  )?.[0];
  expect(body).toBeTruthy();
  return body ?? "";
}

describe("categories migration", () => {
  const guard = functionBody("courses_guard_update\\(\\)");

  it("stores a required unique trimmed name and an optional course category", () => {
    expect(migration).toContain("create table public.categories");
    expect(migration).toContain("name text not null");
    expect(migration).toContain("created_at timestamptz not null default now()");
    expect(migration).toContain(
      "constraint categories_name_trimmed check (name = btrim(name) and name <> '')",
    );
    expect(migration).toContain(
      "create unique index categories_name_uidx on public.categories (name)",
    );
    expect(migration).toContain(
      "add column category_id uuid references public.categories (id) on delete restrict",
    );
    expect(migration).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY/i);
    expect(categoriesApi).not.toMatch(
      /service_role|serviceRole|SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin/,
    );
  });

  it("lets any signed-in user read categories and only an admin write them", () => {
    expect(migration).toContain("grant select on table public.categories to authenticated");
    expect(migration).toContain("grant insert (name) on table public.categories to authenticated");
    expect(migration).toContain("grant update (name) on table public.categories to authenticated");
    expect(migration).toContain("grant delete on table public.categories to authenticated");
    expect(migration).toContain("using (true)");
    expect(migration).toContain("with check (public.current_app_role() = 'admin')");
    expect(migration).toContain("for delete");
    expect(migration).not.toMatch(/grant delete on table public\.courses/i);
    expect(migration).not.toMatch(/enrollments/i);
  });

  it("lets an instructor change category and still blocks an admin from changing it", () => {
    expect(guard).toContain("new.category_id is distinct from old.category_id");
    expect(guard).toContain("admins can change only course status");
    expect(guard).toContain("old.status = 'pending' and new.status = 'published'");
    expect(guard).toContain("old.status = 'published' and new.status = 'archived'");
    expect(guard).toContain("instructors can only submit a draft course for approval");
    expect(migration).toContain(
      "grant update (category_id) on table public.courses to authenticated",
    );
  });
});
