import { describe, expect, it } from "vitest";

import {
  agentSystemPrompt,
  catalogueCountErrorMessage,
  publishedCourseCountMessage,
  studentOnlyAgentMessage,
} from "../../supabase/functions/_shared/agent.ts";
import { bindAgentReader, type AgentDb } from "../../supabase/functions/_shared/agent-reader.ts";
import { runAgentTool, type AgentReader } from "../../supabase/functions/_shared/agent-tools.ts";
import { handleAgent } from "../../supabase/functions/_shared/handle-agent.ts";

const publishableKey = `header.${btoa(JSON.stringify({ role: "anon" }))}.sig`;

function bearer() {
  return `Bearer header.${btoa(JSON.stringify({ sub: "student-1" }))}.sig`;
}

function modelReply(value: unknown) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function reader(publishedCount: AgentReader["publishedCount"]): AgentReader {
  const fail = async (name: string) => {
    throw new Error(`${name} should not run`);
  };
  return {
    userId: async () => ({ ok: true, userId: "student-1" }),
    role: async () => ({ ok: true, role: "student" }),
    matchKnowledge: () => fail("match"),
    course: () => fail("course"),
    enrolled: () => fail("enrolled"),
    lessons: () => fail("lessons"),
    enrol: () => fail("enrol"),
    grades: () => fail("grades"),
    catalogue: () => fail("catalogue"),
    publishedCount,
  };
}

describe("published course count", () => {
  it("describes zero and a positive count without listing courses", () => {
    expect(publishedCourseCountMessage(0)).toBe("There are no published courses.");
    expect(publishedCourseCountMessage(1)).toBe("There is 1 published course.");
    expect(publishedCourseCountMessage(12)).toBe("There are 12 published courses.");
    expect(agentSystemPrompt()).toContain("count_published_courses");
    expect(agentSystemPrompt()).toContain("Do not count search_catalogue matches.");
  });

  it("counts published courses with an exact head query", async () => {
    const { db, calls } = countDb({ count: 12, error: null });
    const counted = await bindAgentReader(db, "token").publishedCount();
    expect(counted).toEqual({ ok: true, count: 12 });
    expect(calls).toEqual([
      ["from", "courses"],
      ["select", "id", { count: "exact", head: true }],
      ["eq", "status", "published"],
    ]);
  });

  it("reports zero published courses instead of treating an empty count as a failure", async () => {
    const counted = await runAgentTool(
      "count_published_courses",
      {},
      toolContext(reader(async () => ({ ok: true, count: 0 }))),
    );
    expect(counted).toEqual({
      ok: true,
      run: {
        name: "count_published_courses",
        payload: { count: 0, message: "There are no published courses." },
        courseIds: [],
        enrolled: null,
      },
    });
  });

  it("returns a clear message when the count query fails and does not search the corpus", async () => {
    const hidden = "database exploded";
    const { db } = countDb({ count: null, error: { message: hidden } });
    const counted = await bindAgentReader(db, "token").publishedCount();
    expect(counted).toEqual({ ok: false, message: catalogueCountErrorMessage });
    expect(JSON.stringify(counted)).not.toContain(hidden);

    const tool = await runAgentTool(
      "count_published_courses",
      { query: "how many chunks" },
      toolContext(reader(async () => counted)),
    );
    expect(tool).toEqual({ ok: false, message: catalogueCountErrorMessage });
  });

  it("answers a total-course question from the count and keeps other roles out", async () => {
    const prompts: string[] = [];
    const responses = [
      modelReply({ type: "tool", name: "count_published_courses", arguments: {} }),
      modelReply({
        type: "answer",
        text: "There are 4 published courses.",
        courses: [],
      }),
    ];
    const response = await handleAgent(question("How many total courses are there?"), {
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      geminiKey: "test-key",
      authorization: bearer(),
      reader: reader(async () => ({ ok: true, count: 4 })),
      fetchImpl: async (_input, init) => {
        prompts.push(String(init?.body));
        const next = responses.shift();
        if (!next) throw new Error("unexpected model call");
        return next;
      },
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      text: "There are 4 published courses.",
      courses: [],
    });
    expect(prompts[1]).toContain("There are 4 published courses.");
    expect(prompts.join("\n")).not.toContain("match_knowledge");

    let counted = false;
    const denied = await handleAgent(question("How many total courses are there?"), {
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      geminiKey: "test-key",
      authorization: bearer(),
      reader: {
        ...reader(async () => {
          counted = true;
          return { ok: true, count: 4 };
        }),
        role: async () => ({ ok: true, role: "instructor" }),
      },
      fetchImpl: () => {
        throw new Error("gemini should not run");
      },
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ ok: false, message: studentOnlyAgentMessage });
    expect(counted).toBe(false);
  });
});

function question(content: string) {
  return new Request("http://localhost/ai-agent", {
    method: "POST",
    headers: { Authorization: bearer() },
    body: JSON.stringify({ messages: [{ role: "user", content }] }),
  });
}

function toolContext(agentReader: AgentReader) {
  return {
    userId: "student-1",
    enrolRequested: false,
    apiKey: "test-key",
    fetchImpl: (() => {
      throw new Error("embedding should not run");
    }) as typeof fetch,
    reader: agentReader,
  };
}

function countDb(result: { count: number | null; error: { message: string } | null }): {
  db: AgentDb;
  calls: unknown[];
} {
  const calls: unknown[] = [];
  const filter = {
    eq(column: string, value: string) {
      calls.push(["eq", column, value]);
      return filter;
    },
    in(column: string, values: string[]) {
      calls.push(["in", column, values]);
      return filter;
    },
    order(column: string, options: { ascending: boolean }) {
      calls.push(["order", column, options]);
      return filter;
    },
    limit(count: number) {
      calls.push(["limit", count]);
      return filter;
    },
    maybeSingle: async () => ({ data: null, error: null }),
    then<TResult1 = { data: null; error: { message: string } | null; count: number | null }>(
      onfulfilled?:
        | ((value: {
            data: null;
            error: { message: string } | null;
            count: number | null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
    ) {
      const value = { data: null, error: result.error, count: result.count };
      return Promise.resolve(onfulfilled ? onfulfilled(value) : (value as TResult1));
    },
  };
  return {
    calls,
    db: {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
      from(table: string) {
        calls.push(["from", table]);
        return {
          select(columns: string, options?: { count?: "exact"; head?: boolean }) {
            calls.push(["select", columns, options]);
            return filter;
          },
          insert: async () => ({ data: null, error: null }),
        };
      },
      rpc: async (fn: string) => {
        calls.push(["rpc", fn]);
        return { data: null, error: null };
      },
    },
  };
}
