import { describe, expect, it } from "vitest";

import { assistantModelContent } from "../../supabase/functions/_shared/agent.ts";
import type { AgentReader } from "../../supabase/functions/_shared/agent-tools.ts";
import {
  contextRoom,
  contextWindowSize,
  createMemoryThreads,
  threadFullMessage,
} from "../../supabase/functions/_shared/ai-thread.ts";
import { handleAgent } from "../../supabase/functions/_shared/handle-agent.ts";

const threadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
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

function reader(): AgentReader {
  return {
    userId: async () => ({ ok: true, userId: "student-1" }),
    role: async () => ({ ok: true, role: "student" }),
    matchKnowledge: async () => {
      throw new Error("match should not run");
    },
    course: async () => {
      throw new Error("course should not run");
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
      throw new Error("catalogue should not run");
    },
    publishedCount: async () => {
      throw new Error("publishedCount should not run");
    },
    latestPublished: async () => {
      throw new Error("latestPublished should not run");
    },
  };
}

function post(body: unknown) {
  return new Request("http://localhost/ai-agent", {
    method: "POST",
    headers: { Authorization: bearer() },
    body: JSON.stringify(body),
  });
}

describe("ai thread window", () => {
  it("counts a normal turn as two slots and a tutor question as four", () => {
    expect(contextRoom(6, 2)).toBe(true);
    expect(contextRoom(6, 4)).toBe(false);
    expect(contextRoom(contextWindowSize, 2)).toBe(false);
  });

  it("keeps a course id in the model text and out of the visible answer", () => {
    const courseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const model = assistantModelContent("Algebra is a fit.", [{ id: courseId, title: "Algebra" }]);
    expect(model).toContain(courseId);
    expect(model.startsWith("Algebra is a fit.")).toBe(true);
  });

  it("sends saved history and rejects another turn when the window is full", async () => {
    const prior = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Saved ${index}`,
    }));
    const full = createMemoryThreads([
      { id: threadId, surface: "assistant", courseId: null, messages: prior },
    ]);
    let called = false;
    const blocked = await handleAgent(post({ threadId, content: "One more" }), {
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      geminiKey: "test-key",
      authorization: bearer(),
      reader: reader(),
      threads: full,
      fetchImpl: async () => {
        called = true;
        return modelReply({ type: "answer", text: "No", courses: [] });
      },
    });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({ ok: false, message: threadFullMessage });
    expect(called).toBe(false);
    expect(full.messages(threadId)).toHaveLength(8);

    const open = createMemoryThreads([
      {
        id: threadId,
        surface: "assistant",
        courseId: null,
        messages: [
          { role: "user", content: "Find algebra" },
          {
            role: "assistant",
            content: "Algebra is a fit.\nCourses: Algebra id bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        ],
      },
    ]);
    const prompts: string[] = [];
    const saved = await handleAgent(post({ threadId, content: "Enrol me in Algebra" }), {
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      geminiKey: "test-key",
      authorization: bearer(),
      reader: reader(),
      threads: open,
      fetchImpl: async (_input, init) => {
        prompts.push(String(init?.body ?? ""));
        const answer = prompts.length === 1;
        return modelReply(
          answer
            ? { agent: "tutor", confidence: 0.9, task: "Continue" }
            : { type: "answer", text: "You can enrol.", courses: [] },
        );
      },
    });
    expect(saved.status).toBe(200);
    expect(prompts.some((prompt) => prompt.includes("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"))).toBe(
      true,
    );
    expect(open.messages(threadId)).toHaveLength(4);
    expect(open.messages(threadId).at(-1)?.content).toContain("You can enrol.");
  });
});
