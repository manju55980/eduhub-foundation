import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261016222000_rag_chunks.sql"),
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

describe("rag chunks migration", () => {
  const policies = policyBodies(migration);
  const match = functionBody(
    "match_knowledge\\(\\s*query_embedding extensions\\.vector\\(768\\),[\\s\\S]*?\\)",
  );

  it("stores 768-dimension chunks with a cosine hnsw index", () => {
    expect(migration).toContain("create extension if not exists vector with schema extensions");
    expect(migration).toContain("create table public.rag_chunks");
    expect(migration).toContain("source_type text not null check (source_type in ('course', 'lesson', 'faq'))");
    expect(migration).toContain("source_key text not null");
    expect(migration).toContain("body text not null");
    expect(migration).toContain("embedding extensions.vector(768)");
    expect(migration).toContain(
      "create unique index rag_chunks_source_key_uidx\n  on public.rag_chunks (source_key);",
    );
    expect(migration).toContain(
      "using hnsw (embedding extensions.vector_cosine_ops);",
    );
    expect(migration).toContain("source_type = 'lesson'");
    expect(migration).toContain("and lesson_id is not null");
    expect(migration).toContain("grant select on table public.rag_chunks to authenticated");
    expect(migration).not.toMatch(/grant insert on table public\.rag_chunks/i);
    expect(migration).not.toMatch(/grant update on table public\.rag_chunks/i);
    expect(migration).not.toMatch(/grant delete on table public\.rag_chunks/i);
    expect(migration).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY/i);
  });

  it("keeps lesson chunks behind enrollment and does not read courses directly", () => {
    expect(policies).toHaveLength(1);
    const policy = policies[0] ?? "";
    expect(policy).not.toMatch(/from\s+public\.courses\b/);
    expect(policy).not.toMatch(/from\s+public\.lessons\b/);
    expect(policy).not.toMatch(/from\s+public\.enrollments\b/);
    expect(policy).toContain("public.current_app_role() = 'admin'");
    expect(policy).toContain("source_type = 'faq'");
    expect(policy).toContain("public.is_course_owner(course_id)");
    expect(policy).toContain("source_type = 'course'");
    expect(policy).toContain("public.is_published_course(course_id)");
    expect(policy).toContain(
      "source_type = 'lesson'\n          and public.is_enrolled(course_id)",
    );
    expect(policy).not.toContain("is_published_course(course_id)\n          and source_type = 'lesson'");
  });

  it("searches as the caller and stops at 10 rows", () => {
    expect(match).toMatch(/security invoker/);
    expect(match).not.toMatch(/security definer/);
    expect(match).toContain("where chunk.embedding is not null");
    expect(match).toContain("1 - (chunk.embedding <=> query_embedding) as similarity");
    expect(match).toContain("limit least(greatest(coalesce(match_count, 0), 0), 10)");
    expect(migration).toContain(
      "grant execute on function public.match_knowledge(extensions.vector, integer) to authenticated",
    );
    expect(migration).not.toContain(
      "grant execute on function public.match_knowledge(extensions.vector, integer) to anon",
    );
    expect(migration).not.toContain(
      "grant execute on function public.match_knowledge(extensions.vector, integer) to public",
    );
    expect(migration).not.toMatch(/create policy courses_/);
    expect(migration).not.toMatch(/create policy lessons_/);
  });
});
