import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const migrationName = "20261109003000_move_policy_helpers_to_private.sql";
const conflictFixName = "20261106170000_fix_campaign_snapshot_conflict.sql";

const helpers = [
  { name: "current_app_role", args: "" },
  { name: "is_course_owner", args: "uuid" },
  { name: "is_enrolled", args: "uuid" },
  { name: "is_published_course", args: "uuid" },
  { name: "is_draft_course", args: "uuid" },
  { name: "is_pending_course", args: "uuid" },
  { name: "lesson_course_id", args: "uuid" },
  { name: "storage_course_id", args: "text" },
  { name: "owns_email_claim", args: "text, uuid" },
] as const;

const adminRpcs = [
  "campaign_audience",
  "create_campaign_snapshot",
  "finish_campaign",
  "mark_campaign_recipient_sent",
  "mark_campaign_recipient_failed",
  "promote_student_to_instructor",
] as const;

const helperPattern = `public\\.(${helpers.map((helper) => helper.name).join("|")})\\(`;

function callsHelper(sql: string) {
  const marker = sql.indexOf("as $$");
  const body = marker === -1 ? sql : sql.slice(marker + "as $$".length);
  return new RegExp(helperPattern).test(body);
}

const migration = readFileSync(resolve(migrationsDir, migrationName), "utf8").replace(
  /\r\n/g,
  "\n",
);

const earlierFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql") && name < migrationName)
  .sort()
  .map((name) => ({
    name,
    sql: readFileSync(resolve(migrationsDir, name), "utf8").replace(/\r\n/g, "\n"),
  }));

function functionDefinitions(sql: string) {
  return [
    ...sql.matchAll(
      /create or replace function (public\.[a-z0-9_]+)\([\s\S]*?\bas\s+\$\$[\s\S]*?\$\$;/g,
    ),
  ].map((match) => ({
    name: match[1]?.slice("public.".length) ?? "",
    sql: match[0],
  }));
}

function policyDefinitions(sql: string) {
  return [...sql.matchAll(/create policy [\s\S]*?;/g)].map((match) => match[0]);
}

function policyName(sql: string) {
  return sql.match(/create policy ([a-z0-9_]+)/)?.[1] ?? "";
}

function replacements() {
  return [...migration.matchAll(/replace\(definition, '([^']+)', '([^']+)'\)/g)].map((match) => ({
    from: match[1] ?? "",
    to: match[2] ?? "",
  }));
}

function rewrite(sql: string) {
  return replacements().reduce(
    (body, replacement) => body.replaceAll(replacement.from, replacement.to),
    sql,
  );
}

const latestFunctions = new Map<string, string>();
const latestPolicies = new Map<string, string>();

for (const file of earlierFiles) {
  for (const definition of functionDefinitions(file.sql)) {
    latestFunctions.set(definition.name, definition.sql);
  }
  for (const policy of policyDefinitions(file.sql)) {
    latestPolicies.set(policyName(policy), policy);
  }
}

const helperPolicies = [...latestPolicies.entries()].filter(([, body]) => callsHelper(body));

describe("private policy helper schema", () => {
  it("moves the nine helpers by schema and leaves their definitions unchanged", () => {
    expect(earlierFiles.at(-1)?.name).toBe(conflictFixName);
    expect(migration).not.toMatch(/create or replace function/i);
    expect(migration).not.toMatch(/alter function [^;]+ owner to/i);

    for (const helper of helpers) {
      const args = helper.args.length === 0 ? "\\(\\)" : `\\(${helper.args}\\)`;
      expect(migration).toContain(
        `alter function public.${helper.name}(${helper.args}) set schema private;`,
      );
      expect(migration).not.toMatch(
        new RegExp(`create or replace function (public|private)\\.${helper.name}${args}`, "i"),
      );

      const definition = latestFunctions.get(helper.name) ?? "";
      expect(definition).toMatch(/language sql/);
      expect(definition).toMatch(/stable/);
      expect(definition).toMatch(/security definer/);
      expect(definition).toMatch(/set search_path = ''/);
      expect(callsHelper(definition)).toBe(false);
    }
  });

  it("grants schema usage and execute only to authenticated", () => {
    expect(migration).toContain("revoke all on schema private from public, anon;");
    expect(migration).toContain("grant usage on schema private to authenticated;");
    expect(migration).not.toMatch(/grant usage on schema private to (anon|public);/);
    expect(migration).not.toMatch(/grant create on schema private/i);

    for (const helper of helpers) {
      const signature = `private.${helper.name}(${helper.args})`;
      expect(migration).toContain(`revoke all on function ${signature} from public, anon;`);
      expect(migration).toContain(`grant execute on function ${signature} to authenticated;`);
      expect(migration).not.toContain(`grant execute on function ${signature} to anon;`);
      expect(migration).not.toContain(`grant execute on function ${signature} to public;`);
    }
  });

  it("rewrites dependent public bodies and keeps the admin RPCs in public", () => {
    expect(migration).toContain("pg_catalog.pg_get_functiondef(fn)");
    expect(replacements()).toHaveLength(helpers.length);

    for (const helper of helpers) {
      expect(replacements().map((replacement) => replacement.from)).toContain(
        `public.${helper.name}(`,
      );
      expect(migration).toContain(`p.prosrc like '%public.${helper.name}(%'`);
      expect(migration).not.toContain(`alter function public.${adminRpcs[0]}`);
    }

    for (const name of adminRpcs) {
      expect(migration).not.toContain(`alter function public.${name}`);
      expect(latestFunctions.get(name)).toBeTruthy();
    }

    const snapshot = rewrite(latestFunctions.get("create_campaign_snapshot") ?? "");
    expect(snapshot).toContain(
      "on conflict on constraint campaigns_idempotency_key_key do nothing",
    );
    expect(snapshot).not.toContain("on conflict (idempotency_key)");
    expect(snapshot).toContain("if private.current_app_role() is distinct from 'admin' then");
    expect(snapshot).toContain("only an admin can send a campaign");
    expect(rewrite(latestFunctions.get("campaign_audience") ?? "")).toContain(
      "only an admin can view campaign segments",
    );
    expect(rewrite(latestFunctions.get("promote_student_to_instructor") ?? "")).toContain(
      "only an admin can promote a student",
    );
  });

  it("keeps policy dependencies and leaves no public helper calls in function bodies", () => {
    expect(migration).not.toMatch(/drop policy/i);
    expect(migration).not.toMatch(/create policy/i);
    expect(helperPolicies).toHaveLength(36);

    for (const [name] of helperPolicies) {
      expect(name).not.toBe("");
      expect(migration).not.toContain(`drop policy if exists ${name}`);
      expect(migration).not.toContain(`drop policy ${name}`);
      expect(migration).not.toContain(`create policy ${name}`);
    }

    const calls = [...latestFunctions.entries()].filter(([, body]) => callsHelper(body));
    expect(calls.map(([name]) => name).sort()).toEqual([
      "campaign_audience",
      "courses_guard_update",
      "create_campaign_snapshot",
      "finish_campaign",
      "lesson_completions_sync_progress",
      "mark_campaign_recipient_failed",
      "mark_campaign_recipient_sent",
      "prevent_profile_role_change",
      "promote_student_to_instructor",
    ]);

    for (const [, body] of calls) {
      const updated = rewrite(body);
      expect(callsHelper(updated)).toBe(false);
      expect(updated).toMatch(/private\.(current_app_role|lesson_course_id)\(/);
      expect(updated.startsWith("create or replace function public.")).toBe(true);
    }
  });
});
