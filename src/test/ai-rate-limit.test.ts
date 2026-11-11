import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  consumeAiRequest,
  type AiFeature,
  type AiRateDb,
} from "../../supabase/functions/_shared/ai-rate-limit.ts";
import { handleAgent } from "../../supabase/functions/_shared/handle-agent.ts";
import { handleCourseBuilder } from "../../supabase/functions/_shared/handle-course-builder.ts";
import { handleCourseReview } from "../../supabase/functions/_shared/handle-course-review.ts";
import { handleStudy } from "../../supabase/functions/_shared/handle-study.ts";
import type { AgentReader } from "../../supabase/functions/_shared/agent-tools.ts";
import { failedAiMessage } from "../../supabase/functions/_shared/gemini.ts";
import type { ReviewReader } from "../../supabase/functions/_shared/review-reader.ts";
import type { StudyReader } from "../../supabase/functions/_shared/study-reader.ts";

const courseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261109010000_ai_request_limits.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const limits: Record<AiFeature, number> = {
  "ai-study": 30,
  "ai-agent": 20,
  "ai-course-builder": 10,
  "ai-course-review": 10,
};

function functionSql(schema: "private" | "public") {
  const body = migration.match(
    new RegExp(
      `create or replace function ${schema}\\.consume_ai_request\\(requested_feature text\\)[\\s\\S]*?\\$\\$;`,
    ),
  )?.[0];
  expect(body, schema).toBeTruthy();
  return body ?? "";
}

function signature(body: string) {
  return body.slice(0, body.indexOf("returns boolean"));
}

function applyAtomicIncrement(count: number | undefined, limit: number) {
  if (count == null) return { allowed: true, count: 1 };
  if (count < limit) return { allowed: true, count: count + 1 };
  return { allowed: false, count };
}

function bearer() {
  const payload = btoa(JSON.stringify({ sub: "user-1" }));
  return `Bearer ${btoa(JSON.stringify({ alg: "none", typ: "JWT" }))}.${payload}.sig`;
}

function post(body: unknown) {
  return new Request("http://localhost/function", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function rateDb(
  result: { data: unknown; error: { message: string } | null },
  calls: string[],
): AiRateDb {
  return {
    async rpc(fn, args) {
      calls.push(`${fn}:${JSON.stringify(args)}`);
      return result;
    },
  };
}

function baseDeps(rateLimit: AiRateDb, fetchImpl: typeof fetch) {
  return {
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "publishable-key",
    geminiKey: "test-gemini-key",
    authorization: bearer(),
    fetchImpl,
    rateLimit,
  };
}

function studyReader(role: string): StudyReader {
  return {
    async userId() {
      return { ok: true, userId: "user-1" };
    },
    async role() {
      return { ok: true, role };
    },
    async course() {
      return { ok: true, course: { title: "Algebra", description: "Numbers" } };
    },
    async enrolled() {
      return { ok: true, enrolled: true };
    },
    async lessons() {
      return { ok: true, lessons: [{ title: "Sums", content: "Add numbers" }] };
    },
  };
}

function reviewReader(role: string): ReviewReader {
  return {
    async userId() {
      return { ok: true, userId: "user-1" };
    },
    async role() {
      return { ok: true, role };
    },
    async course() {
      return {
        ok: true,
        course: { title: "Plants", description: "Leaves", level: "beginner", status: "pending" },
      };
    },
    async lessons() {
      return { ok: true, lessons: [] };
    },
    async assignments() {
      return { ok: true, assignments: [] };
    },
    async materials() {
      return { ok: true, materials: [] };
    },
    async insertReview() {
      throw new Error("review save should not run");
    },
  };
}

function agentReader(role: string): AgentReader {
  const unused = async () => {
    throw new Error("agent tool should not run");
  };
  return {
    async userId() {
      return { ok: true, userId: "user-1" };
    },
    async role() {
      return { ok: true, role };
    },
    matchKnowledge: unused,
    course: unused,
    enrolled: unused,
    lessons: unused,
    enrol: unused,
    grades: unused,
    catalogue: unused,
    publishedCount: unused,
    latestPublished: unused,
  };
}

describe("AI request limit migration", () => {
  const privateFn = functionSql("private");
  const publicFn = functionSql("public");

  it("increments one hourly counter atomically and stops at the hardcoded limit", () => {
    expect(privateFn).toContain("security definer");
    expect(privateFn).toContain("set search_path = ''");
    expect(privateFn).toContain("pg_catalog.date_trunc('hour', pg_catalog.now())");
    expect(privateFn).toContain("on conflict on constraint ai_request_counters_pkey");
    expect(privateFn).toContain("where counter.request_count < feature_limit");
    expect(privateFn).toContain("returning true into allowed");
    expect(privateFn).not.toContain("select request_count");
    for (const [feature, limit] of Object.entries(limits)) {
      expect(privateFn).toContain(`when '${feature}' then ${limit}`);
    }

    for (const limit of Object.values(limits)) {
      let count: number | undefined;
      for (let request = 1; request <= limit; request += 1) {
        const result = applyAtomicIncrement(count, limit);
        expect(result.allowed).toBe(true);
        count = result.count;
      }
      const denied = applyAtomicIncrement(count, limit);
      expect(denied).toEqual({ allowed: false, count: limit });
      expect(applyAtomicIncrement(denied.count, limit).count).toBe(limit);
    }
  });

  it("derives the caller from auth.uid() and does not accept a user id or a limit", () => {
    expect(signature(privateFn)).toBe(
      "create or replace function private.consume_ai_request(requested_feature text)\n",
    );
    expect(signature(publicFn)).toBe(
      "create or replace function public.consume_ai_request(requested_feature text)\n",
    );
    expect(signature(privateFn)).not.toContain("user_id");
    expect(signature(privateFn)).not.toContain("feature_limit");
    expect(privateFn).toContain("caller := auth.uid();");
    expect(privateFn).toContain("values (caller, requested_feature, bucket, 1)");
  });

  it("rejects anonymous callers, direct table access, and anyone except authenticated", () => {
    expect(privateFn).toContain("if caller is null then");
    expect(privateFn).toContain("return false;");
    expect(migration).toContain(
      "alter table private.ai_request_counters enable row level security",
    );
    expect(migration).not.toContain("force row level security");
    expect(migration).not.toContain("create policy");
    expect(migration).toContain(
      "revoke all on table private.ai_request_counters from public, anon, authenticated, service_role;",
    );
    expect(migration).not.toMatch(
      /grant\s+(?:select|insert|update|delete|all)\s+on table private\.ai_request_counters/i,
    );
    for (const schema of ["private", "public"] as const) {
      expect(migration).toContain(
        `revoke all on function ${schema}.consume_ai_request(text) from public, anon, service_role;`,
      );
      expect(migration).toContain(
        `grant execute on function ${schema}.consume_ai_request(text) to authenticated;`,
      );
    }
    expect(migration).not.toMatch(
      /grant execute on function (?:private|public)\.consume_ai_request\(text\) to anon;/,
    );
    expect(migration).not.toMatch(
      /grant execute on function (?:private|public)\.consume_ai_request\(text\) to public;/,
    );
    expect(migration).not.toMatch(/grant usage on schema private to anon/);
    expect(migration).not.toMatch(/grant usage on schema private to public/);
  });

  it("returns false for an unknown feature and keeps the public wrapper as an invoker", () => {
    expect(privateFn).toContain("else null");
    expect(privateFn).toContain("if feature_limit is null then");
    expect(migration).toContain(
      "feature in ('ai-study', 'ai-agent', 'ai-course-builder', 'ai-course-review')",
    );
    expect(publicFn).toContain("security invoker");
    expect(publicFn).not.toContain("security definer");
    expect(publicFn).toContain("set search_path = ''");
    expect(publicFn).toContain("return private.consume_ai_request(requested_feature);");
  });
});

describe("AI request limit helper", () => {
  it("sends only the feature name and maps denial, failure, and allowance", async () => {
    const calls: string[] = [];
    const allowed = await consumeAiRequest(rateDb({ data: true, error: null }, calls), "ai-study");
    expect(allowed).toEqual({ ok: true });
    expect(calls).toEqual(['consume_ai_request:{"requested_feature":"ai-study"}']);

    const denied = await consumeAiRequest(rateDb({ data: false, error: null }, calls), "ai-agent");
    expect(denied).toEqual({
      ok: false,
      status: 429,
      message: "Too many AI requests. Try again later.",
    });

    const failed = await consumeAiRequest(
      rateDb({ data: null, error: { message: "relation does not exist" } }, calls),
      "ai-course-builder",
    );
    expect(failed).toEqual({ ok: false, status: 500, message: failedAiMessage });

    const malformed = await consumeAiRequest(
      rateDb({ data: { allowed: true }, error: null }, calls),
      "ai-course-review",
    );
    expect(malformed.status).toBe(500);
    expect(calls.join(" ")).not.toContain("user_id");
  });
});

describe("AI handlers return 429 before Gemini", () => {
  it("stops each accepted feature at the limiter", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>();
    const denied = rateDb({ data: false, error: null }, calls);
    const deps = baseDeps(denied, fetchImpl);

    const study = await handleStudy(post({ courseId, question: "Explain addition." }), {
      ...deps,
      reader: studyReader("student"),
    });
    const builder = await handleCourseBuilder(
      post({ brief: "Teach plants.", level: "beginner", lessonCount: 1, assignmentCount: 0 }),
      {
        ...deps,
        reader: { userId: studyReader("instructor").userId, role: studyReader("instructor").role },
      },
    );
    const review = await handleCourseReview(post({ courseId }), {
      ...deps,
      reader: reviewReader("admin"),
    });
    const agent = await handleAgent(post({ messages: [{ role: "user", content: "Hello" }] }), {
      ...deps,
      reader: agentReader("student"),
    });

    for (const response of [study, builder, review, agent]) {
      expect(response.status).toBe(429);
      expect(await response.json()).toEqual({
        ok: false,
        message: "Too many AI requests. Try again later.",
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'consume_ai_request:{"requested_feature":"ai-study"}',
      'consume_ai_request:{"requested_feature":"ai-course-builder"}',
      'consume_ai_request:{"requested_feature":"ai-course-review"}',
      'consume_ai_request:{"requested_feature":"ai-agent"}',
    ]);
  });

  it("does not consume a request for the wrong role or a missing Gemini key", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>();
    const denied = rateDb({ data: false, error: null }, calls);
    const deps = baseDeps(denied, fetchImpl);

    const study = await handleStudy(post({ courseId, question: "Explain addition." }), {
      ...deps,
      reader: studyReader("instructor"),
    });
    const unconfigured = await handleStudy(post({ courseId, question: "Explain addition." }), {
      ...deps,
      geminiKey: undefined,
      reader: studyReader("student"),
    });

    expect(study.status).toBe(403);
    expect(await unconfigured.json()).toEqual({ ok: false, message: "AI is not configured." });
    expect(calls).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("calls Gemini once when the limiter allows the request", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("nope", { status: 500 }));
    const response = await handleStudy(post({ courseId, question: "Explain addition." }), {
      ...baseDeps(rateDb({ data: true, error: null }, calls), fetchImpl),
      reader: studyReader("student"),
    });

    expect(response.status).not.toBe(429);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(calls).toEqual(['consume_ai_request:{"requested_feature":"ai-study"}']);
  });
});
