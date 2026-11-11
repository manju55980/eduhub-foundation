import { describe, expect, it, vi } from "vitest";

import {
  matchLatestPublished,
  routeAdvisorTool,
  selectSpecialist,
  specialistSystemPrompt,
  specialistTools,
} from "../../supabase/functions/_shared/agent-team.ts";
import { bindAgentReader, type AgentDb } from "../../supabase/functions/_shared/agent-reader.ts";
import type { AgentReader } from "../../supabase/functions/_shared/agent-tools.ts";
import { embedTextsWithOllama } from "../../supabase/functions/_shared/embeddings.ts";
import { handleAgent } from "../../supabase/functions/_shared/handle-agent.ts";
import { authorizeTool } from "../../supabase/functions/_shared/guardrails.ts";
import { settleEdgeReports } from "../../supabase/functions/_shared/sentry.ts";

const olderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const newerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const designId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const question = "What is the latest course published for the tech?";
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

describe("latest published course", () => {
  it("keeps the newest published course in the named category", () => {
    const matches = matchLatestPublished(
      [
        {
          id: olderId,
          createdAt: "2026-01-01T00:00:00.000Z",
          categoryName: "Technology",
        },
        {
          id: designId,
          createdAt: "2026-11-01T00:00:00.000Z",
          categoryName: "Design",
        },
        {
          id: newerId,
          createdAt: "2026-10-01T00:00:00.000Z",
          categoryName: "Technology",
        },
      ],
      question,
    );
    expect(matches.map((course) => course.id)).toEqual([newerId, olderId]);
    expect(authorizeTool("latest_published_course", specialistTools("advisor"))).toBe(true);
    expect(authorizeTool("latest_published_course", specialistTools("tutor"))).toBe(false);
    expect(specialistSystemPrompt("advisor")).toContain(
      "Do not use search_catalogue for that question.",
    );
    expect(
      selectSpecialist({ agent: "tutor", confidence: 0.95 }, [{ role: "user", content: question }]),
    ).toEqual({ kind: "run", agent: "advisor" });
    expect(routeAdvisorTool("search_catalogue", [{ role: "user", content: question }])).toBe(
      "latest_published_course",
    );
  });

  it("reads published courses with the student client, newest first", async () => {
    const { db, calls } = listingDb([
      {
        id: newerId,
        title: "Networks",
        status: "published",
        created_at: "2026-10-01T00:00:00.000Z",
        categories: { name: "Technology" },
      },
    ]);
    const listed = await bindAgentReader(db, "token").latestPublished();
    expect(listed).toEqual({
      ok: true,
      courses: [
        {
          id: newerId,
          title: "Networks",
          createdAt: "2026-10-01T00:00:00.000Z",
          categoryName: "Technology",
        },
      ],
    });
    expect(calls).toEqual([
      ["from", "courses"],
      ["select", "id, title, status, created_at, categories(name)"],
      ["eq", "status", "published"],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("answers a latest-category question without catalogue search", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes("/api/embed")) throw new Error("embed should not run");
      const next = responses.shift();
      if (!next) throw new Error("unexpected model call");
      return next;
    });
    const responses = [
      modelReply({ agent: "tutor", confidence: 0.9, task: "Search the catalogue." }),
      modelReply({
        type: "tool",
        name: "search_catalogue",
        arguments: { query: "latest tech course" },
      }),
      modelReply({
        type: "answer",
        text: "Networks is the latest technology course.",
        courses: [
          { id: newerId, title: "Networks" },
          { id: designId, title: "Design systems" },
        ],
      }),
    ];
    const reader: AgentReader = {
      async userId() {
        calls.push("user");
        return { ok: true, userId: "student-1" };
      },
      async role() {
        calls.push("role");
        return { ok: true, role: "student" };
      },
      matchKnowledge: async () => {
        throw new Error("search should not run");
      },
      course: async () => {
        throw new Error("describe should not run");
      },
      enrolled: async () => {
        throw new Error("enrolled should not run");
      },
      lessons: async () => {
        throw new Error("lessons should not run");
      },
      enrol: async () => {
        throw new Error("enrol should not run");
      },
      grades: async () => {
        throw new Error("grades should not run");
      },
      catalogue: async () => {
        throw new Error("suggest should not run");
      },
      publishedCount: async () => {
        throw new Error("count should not run");
      },
      async latestPublished() {
        calls.push("latestPublished");
        return {
          ok: true,
          courses: [
            {
              id: olderId,
              title: "Intro to Tech",
              createdAt: "2026-01-01T00:00:00.000Z",
              categoryName: "Technology",
            },
            {
              id: newerId,
              title: "Networks",
              createdAt: "2026-10-01T00:00:00.000Z",
              categoryName: "Technology",
            },
            {
              id: designId,
              title: "Design systems",
              createdAt: "2026-11-01T00:00:00.000Z",
              categoryName: "Design",
            },
          ],
        };
      },
    };
    const response = await handleAgent(
      new Request("http://localhost/ai-agent", {
        method: "POST",
        headers: { Authorization: bearer() },
        body: JSON.stringify({ messages: [{ role: "user", content: question }] }),
      }),
      {
        supabaseUrl: "https://example.supabase.co",
        publishableKey,
        geminiKey: "test-key",
        authorization: bearer(),
        reader,
        fetchImpl,
      },
    );
    expect(await response.json()).toMatchObject({
      ok: true,
      text: "Networks is the latest technology course.",
      courses: [{ id: newerId, title: "Networks" }],
      enrolled: null,
    });
    expect(calls).toContain("latestPublished");
    expect(calls).not.toContain("match");
    expect(fetchImpl).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/embed"),
      expect.anything(),
    );
  });

  it("logs an Ollama connection failure without the host", async () => {
    const host = "https://tunnel.example.test/secret-path";
    const logged: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
    try {
      const result = await embedTextsWithOllama(
        { host, texts: ["algebra"], taskType: "RETRIEVAL_QUERY", maxAttempts: 1 },
        async () => {
          throw new Error(`connect failed ${host}`);
        },
      );
      await settleEdgeReports();
      expect(result).toMatchObject({ ok: false, message: "The AI request failed." });
      expect(logged[0]).toContain('"source":"ollama-embed"');
      expect(logged[0]).toContain('"status":null');
      expect(logged[0]).toContain('"kind":"network"');
      expect(logged[0]).not.toContain(host);
      expect(logged[0]).not.toContain("algebra");
    } finally {
      spy.mockRestore();
    }
  });
});

function listingDb(rows: unknown[]): { db: AgentDb; calls: unknown[] } {
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
    then<TResult1 = { data: unknown; error: null }>(
      onfulfilled?:
        ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    ) {
      const value = { data: rows, error: null };
      return Promise.resolve(onfulfilled ? onfulfilled(value) : (value as TResult1));
    },
  };
  return {
    calls,
    db: {
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from(table: string) {
        calls.push(["from", table]);
        return {
          select(columns: string) {
            calls.push(["select", columns]);
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
