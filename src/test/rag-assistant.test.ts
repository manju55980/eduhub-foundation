import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { enrollmentInsert } from "@/features/student/enrollment";
import {
  agentEnrollmentInsert,
  enrolRequested,
  parseAgentMessages,
  suggestNextCourse,
  unfinishedAgentMessage,
} from "../../supabase/functions/_shared/agent.ts";
import type { AgentReader } from "../../supabase/functions/_shared/agent-tools.ts";
import {
  embedRequestBody,
  embeddingDimensions,
  embeddingModel,
  embeddingTimeoutMs,
  l2Normalize,
  parseOllamaEmbedResponse,
  prefixedEmbedText,
} from "../../supabase/functions/_shared/embeddings.ts";
import { agentChatTimeoutMs, handleAgent } from "../../supabase/functions/_shared/handle-agent.ts";
import { failedAiMessage } from "../../supabase/functions/_shared/gemini.ts";
import {
  courseChunk,
  faqChunkCount,
  faqChunks,
  faqSourceKey,
  lessonChunk,
  planChunkWrites,
} from "../../supabase/functions/_shared/rag-corpus.ts";
import { readSeedEnv, runRagSeed } from "../../supabase/functions/_shared/rag-seed.ts";
import { isServiceRoleKey } from "../../supabase/functions/_shared/user-client.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const courseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherCourseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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

function post(body: unknown) {
  return new Request("http://localhost/ai-agent", {
    method: "POST",
    headers: { Authorization: bearer() },
    body: JSON.stringify(body),
  });
}

function baseReader(overrides: Partial<AgentReader> = {}): AgentReader & { calls: string[] } {
  const calls: string[] = [];
  const fail = async (name: string) => {
    calls.push(name);
    throw new Error(`${name} should not run`);
  };
  return {
    calls,
    userId: async () => {
      calls.push("user");
      return { ok: true, userId: "student-1" };
    },
    role: async () => {
      calls.push("role");
      return { ok: true, role: "student" };
    },
    matchKnowledge: () => fail("match"),
    course: () => fail("course"),
    enrolled: () => fail("enrolled"),
    lessons: () => fail("lessons"),
    enrol: () => fail("enrol"),
    grades: async () => {
      calls.push("grades");
      return { ok: true, grades: [] };
    },
    catalogue: () => fail("catalogue"),
    publishedCount: () => fail("publishedCount"),
    ...overrides,
  };
}

function deps(
  reader: AgentReader,
  fetchImpl: typeof fetch,
  geminiKey: string | undefined = "test-key",
) {
  return {
    supabaseUrl: "https://example.supabase.co",
    publishableKey,
    geminiKey,
    authorization: bearer(),
    reader,
    fetchImpl,
  };
}

describe("rag corpus", () => {
  it("builds 5000 faq chunks and catalogue chunks with stable keys", () => {
    const faqs = faqChunks();
    expect(faqs).toHaveLength(faqChunkCount);
    expect(new Set(faqs.map((chunk) => chunk.sourceKey)).size).toBe(faqChunkCount);
    expect(faqs[0]?.sourceKey).toBe("faq:0001");
    expect(faqs.at(-1)?.sourceKey).toBe(faqSourceKey(5000));
    expect(
      faqs.every((chunk) => chunk.courseId === null && chunk.lessonId === null && chunk.body),
    ).toBe(true);

    const course = courseChunk({ id: courseId, title: "Algebra", description: "Numbers" });
    expect(course).toMatchObject({
      sourceKey: `course:${courseId}`,
      courseId,
      lessonId: null,
      body: "Algebra\nNumbers",
    });
    const lesson = lessonChunk({
      id: otherCourseId,
      courseId,
      title: "Lesson 1",
      content: "Add numbers",
    });
    expect(lesson).toMatchObject({
      sourceKey: `lesson:${otherCourseId}`,
      courseId,
      lessonId: otherCourseId,
    });
  });

  it("reembeds a chunk only when its text changes", () => {
    const current = courseChunk({ id: courseId, title: "Algebra", description: "Numbers" });
    const same = courseChunk({ id: courseId, title: "Algebra", description: "Numbers" });
    const changed = courseChunk({ id: courseId, title: "Algebra", description: "More numbers" });
    expect(planChunkWrites([current], [same])).toEqual([]);
    expect(planChunkWrites([current], [changed]).map((chunk) => chunk.sourceKey)).toEqual([
      `course:${courseId}`,
    ]);
  });

  it("normalizes 768-dimensional embeddings and rejects other sizes", () => {
    const ones = Array.from({ length: embeddingDimensions }, () => 1);
    const normalized = l2Normalize(ones);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    const norm = Math.sqrt(normalized.values.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1);
    expect(l2Normalize(Array.from({ length: embeddingDimensions }, () => 0)).ok).toBe(false);
    expect(l2Normalize(Array.from({ length: 3072 }, () => 1)).ok).toBe(false);

    expect(prefixedEmbedText("lesson text", "RETRIEVAL_DOCUMENT")).toBe(
      "search_document: lesson text",
    );
    expect(prefixedEmbedText("lesson text", "RETRIEVAL_QUERY")).toBe("search_query: lesson text");
    const parsed = parseOllamaEmbedResponse(
      { embeddings: [Array.from({ length: embeddingDimensions }, () => 0.5)] },
      1,
    );
    expect(parsed.ok).toBe(true);

    const body = embedRequestBody(["lesson text"], "RETRIEVAL_DOCUMENT");
    expect(body.requests[0]).toMatchObject({
      model: `models/${embeddingModel}`,
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768,
    });
  });

  it("requires a service-role key and does not echo secrets", () => {
    const secret = "sb_secret_example";
    expect(
      readSeedEnv({ SUPABASE_SERVICE_ROLE_KEY: secret, OLLAMA_HOST: "http://127.0.0.1:11434" })
        .message,
    ).toBe("The service role key is required.");
    const anon = readSeedEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: publishableKey,
      GEMINI_API_KEY: "test-key",
    });
    expect(anon.ok).toBe(false);
    if (anon.ok) return;
    expect(anon.message).toBe("The service role key is required.");
    expect(anon.message).not.toContain(publishableKey);
    expect(isServiceRoleKey(secret)).toBe(true);

    const seed = readFileSync(resolve(root, "scripts/seed-rag-chunks.ts"), "utf8");
    const agent = readFileSync(resolve(root, "supabase/functions/ai-agent/index.ts"), "utf8");
    const api = readFileSync(
      resolve(root, "src/features/student/learning-assistant-api.ts"),
      "utf8",
    );
    expect(seed).not.toMatch(/console\.(log|error)\([^)]*env\.(key|gemini)/);
    expect(agent).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(api).not.toContain("GEMINI_API_KEY");
    expect(api).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
    expect(config).toMatch(/\[functions\.ai-agent\]\s+verify_jwt = true/);
  });

  it("skips embeddings when every chunk is unchanged", async () => {
    const faqs = faqChunks();
    const upsert = vi.fn();
    const result = await runRagSeed({
      geminiKey: "test-key",
      fetchImpl: () => {
        throw new Error("embed should not run");
      },
      db: {
        courses: async () => ({ ok: true, rows: [] }),
        lessons: async () => ({ ok: true, rows: [] }),
        chunks: async () => ({
          ok: true,
          rows: faqs.map((chunk) => ({
            sourceKey: chunk.sourceKey,
            title: chunk.title,
            body: chunk.body,
          })),
        }),
        upsert,
      },
    });
    expect(result).toMatchObject({ ok: true, faqCount: 5000, embedded: 0, unchanged: 5000 });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("learning assistant", () => {
  it("keeps the latest user messages and enrols only when asked", () => {
    const parsed = parseAgentMessages({
      messages: [
        { role: "tool", content: "ignore" },
        { role: "user", content: `  ${"a".repeat(1200)}` },
        ...Array.from({ length: 8 }, () => ({ role: "assistant", content: "ok" })),
        { role: "user", content: "Please enrol me" },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.messages).toHaveLength(8);
    expect(parsed.messages.at(-1)?.content).toBe("Please enrol me");
    expect(enrolRequested(parsed.messages)).toBe(true);
    const long = parseAgentMessages({
      messages: [{ role: "user", content: ` ${"a".repeat(1200)}` }],
    });
    expect(long.ok).toBe(true);
    if (long.ok) expect(long.messages[0]?.content).toHaveLength(1000);
    expect(enrolRequested([{ role: "user", content: "What is algebra?" }])).toBe(false);
    expect(parseAgentMessages({ messages: [{ role: "user", content: "   " }] }).ok).toBe(false);
    expect(agentEnrollmentInsert("student-1", courseId)).toEqual(
      enrollmentInsert("student-1", courseId),
    );
  });

  it("suggests a published course in the same category, then the next level", () => {
    const published = [
      course("new-advanced", "advanced", "cat-a", "2026-10-03"),
      course("same-category", "beginner", "cat-b", "2026-10-02"),
      course("next-level", "intermediate", "cat-c", "2026-10-04"),
    ];
    expect(
      suggestNextCourse({
        enrollments: [
          { courseId: "done", status: "completed", level: "beginner", categoryId: "cat-b" },
        ],
        published,
      })?.id,
    ).toBe("same-category");
    expect(
      suggestNextCourse({
        enrollments: [
          { courseId: "done", status: "completed", level: "beginner", categoryId: null },
        ],
        published,
      })?.id,
    ).toBe("next-level");
    expect(
      suggestNextCourse({
        enrollments: [
          { courseId: "next-level", status: "active", level: "intermediate", categoryId: null },
        ],
        published,
      })?.id,
    ).toBe("new-advanced");
  });

  it("checks the student role before retrieval and drops course ids the tools did not return", async () => {
    const reader = baseReader({
      role: async () => {
        reader.calls.push("role");
        return { ok: true, role: "instructor" };
      },
    });
    const denied = await handleAgent(
      post({ messages: [{ role: "user", content: "Recommend a course" }] }),
      deps(reader, () => {
        throw new Error("gemini should not run");
      }),
    );
    expect(denied.status).toBe(403);
    expect(reader.calls).toEqual(["user", "role"]);

    const searchReader = baseReader({
      matchKnowledge: async (literal) => {
        searchReader.calls.push("match");
        expect(literal.startsWith("[")).toBe(true);
        expect(literal.split(",")).toHaveLength(768);
        return {
          ok: true,
          matches: [
            {
              id: "chunk-1",
              sourceType: "course",
              title: "Algebra",
              body: "Numbers",
              courseId,
              similarity: 0.9,
            },
          ],
        };
      },
    });
    const responses = [
      modelReply({ type: "tool", name: "search_catalogue", arguments: { query: "algebra" } }),
      modelReply({
        type: "answer",
        text: "Algebra matches.",
        courses: [
          { id: courseId, title: "Algebra" },
          { id: otherCourseId, title: "Not retrieved" },
        ],
      }),
    ];
    const embedBodies: unknown[] = [];
    const response = await handleAgent(
      post({ messages: [{ role: "user", content: "Find algebra" }] }),
      deps(searchReader, async (input, init) => {
        const url = String(input);
        if (url.includes("/api/embed")) {
          embedBodies.push(JSON.parse(String(init?.body)));
          return new Response(
            JSON.stringify({ embeddings: [Array.from({ length: 768 }, () => 0.5)] }),
            { status: 200 },
          );
        }
        const next = responses.shift();
        if (!next) throw new Error("unexpected model call");
        return next;
      }),
    );
    const body = await response.json();
    expect(body.courses).toEqual([{ id: courseId, title: "Algebra" }]);
    expect(embedBodies[0]).toMatchObject({
      model: "nomic-embed-text",
      input: ["search_query: algebra"],
    });
    expect(searchReader.calls).toContain("match");
    expect(searchReader.calls).not.toContain("lessons");
  });

  it("does not enrol unless the latest message asks, and stops a fourth tool call", async () => {
    const reader = baseReader();
    const refused = await handleAgent(
      post({ messages: [{ role: "user", content: "Tell me about algebra" }] }),
      deps(reader, async () =>
        modelReply({
          type: "tool",
          name: "enrol_in_course",
          arguments: { courseId },
        }),
      ),
    );
    const first = await refused.json();
    expect(reader.calls).not.toContain("enrol");

    const answered = await handleAgent(
      post({ messages: [{ role: "user", content: "Tell me about algebra" }] }),
      deps(
        reader,
        sequential([
          modelReply({ type: "tool", name: "enrol_in_course", arguments: { courseId } }),
          modelReply({ type: "answer", text: "I have not enrolled you.", courses: [] }),
        ]),
      ),
    );
    expect(await answered.json()).toMatchObject({ ok: true, text: "I have not enrolled you." });

    let gradeCalls = 0;
    const limited = await handleAgent(
      post({ messages: [{ role: "user", content: "Show my grades" }] }),
      deps(
        baseReader({
          grades: async () => {
            gradeCalls += 1;
            return { ok: true, grades: [] };
          },
        }),
        async () => modelReply({ type: "tool", name: "fetch_my_grades", arguments: {} }),
      ),
    );
    expect(limited.status).toBe(200);
    expect(await limited.json()).toMatchObject({ ok: false, message: unfinishedAgentMessage });
    expect(gradeCalls).toBe(3);
    expect(first.ok).toBe(false);
  });

  it("hides lesson text until the student is enrolled", async () => {
    const reader = baseReader({
      course: async () => ({
        ok: true,
        course: {
          id: courseId,
          title: "Algebra",
          description: "Numbers",
          level: "beginner",
          status: "published",
          categoryId: null,
          createdAt: "2026-10-01",
        },
      }),
      enrolled: async () => ({ ok: true, enrolled: false }),
    });
    const response = await handleAgent(
      post({ messages: [{ role: "user", content: "Describe this course" }] }),
      deps(
        reader,
        sequential([
          modelReply({ type: "tool", name: "describe_course", arguments: { courseId } }),
          modelReply({ type: "answer", text: "Here is the description.", courses: [] }),
        ]),
      ),
    );
    expect(response.ok).toBe(true);
    expect(reader.calls).not.toContain("lessons");
  });

  it("returns the missing-key message before a catalogue read", async () => {
    const reader = baseReader();
    const response = await handleAgent(
      post({ messages: [{ role: "user", content: "Recommend a course" }] }),
      deps(
        reader,
        () => {
          throw new Error("gemini should not run");
        },
        "",
      ),
    );
    expect(await response.json()).toMatchObject({ ok: false, message: "AI is not configured." });
    expect(reader.calls).toEqual(["user", "role"]);
  });

  it("accepts a chat reply after 20 seconds and still searches the catalogue", async () => {
    vi.useFakeTimers();
    try {
      const searchReader = catalogueReader();
      let chats = 0;
      const response = handleAgent(
        post({ messages: [{ role: "user", content: "Find algebra" }] }),
        deps(searchReader, async (input, init) => {
          if (String(input).includes("/api/embed")) return embedResponse();
          chats += 1;
          if (chats === 1) await wait(embeddingTimeoutMs + 1_000, init?.signal);
          return chats === 1 ? searchReply() : answerReply();
        }),
      );
      await vi.advanceTimersByTimeAsync(embeddingTimeoutMs + 1_000);
      expect(await (await response).json()).toMatchObject({
        ok: true,
        text: "Algebra matches.",
        courses: [{ id: courseId, title: "Algebra" }],
      });
      expect(searchReader.calls).toContain("match");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the AI failure when a chat reply exceeds 45 seconds", async () => {
    vi.useFakeTimers();
    try {
      const reader = baseReader();
      const response = handleAgent(
        post({ messages: [{ role: "user", content: "Find algebra" }] }),
        deps(reader, (_input, init) => waitForAbort(init?.signal)),
      );
      await vi.advanceTimersByTimeAsync(agentChatTimeoutMs);
      expect(await (await response).json()).toMatchObject({
        ok: false,
        message: failedAiMessage,
      });
      expect(reader.calls).toEqual(["user", "role"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not apply the chat timeout to an embed request that already has a signal", async () => {
    vi.useFakeTimers();
    try {
      const searchReader = catalogueReader();
      let embedSignal: AbortSignal | undefined;
      let chats = 0;
      const response = handleAgent(
        post({ messages: [{ role: "user", content: "Find algebra" }] }),
        deps(searchReader, async (input, init) => {
          if (!String(input).includes("/api/embed")) {
            chats += 1;
            return chats === 1 ? searchReply() : answerReply();
          }
          embedSignal = init?.signal;
          await wait(agentChatTimeoutMs + 1_000, init?.signal);
          return embedResponse();
        }),
      );
      await vi.advanceTimersByTimeAsync(agentChatTimeoutMs + 1_000);
      expect(await (await response).json()).toMatchObject({
        ok: true,
        text: "Algebra matches.",
      });
      expect(embedSignal?.aborted).toBe(false);
      expect(searchReader.calls).toContain("match");
    } finally {
      vi.useRealTimers();
    }
  });
});

function course(id: string, level: string, categoryId: string, createdAt: string) {
  return { id, title: id, level, categoryId, createdAt };
}

function catalogueReader() {
  const reader = baseReader();
  reader.matchKnowledge = async (literal) => {
    reader.calls.push("match");
    expect(literal.split(",")).toHaveLength(768);
    return {
      ok: true,
      matches: [
        {
          id: "chunk-1",
          sourceType: "course",
          title: "Algebra",
          body: "Numbers",
          courseId,
          similarity: 0.9,
        },
      ],
    };
  };
  return reader;
}

function searchReply() {
  return modelReply({ type: "tool", name: "search_catalogue", arguments: { query: "algebra" } });
}

function answerReply() {
  return modelReply({
    type: "answer",
    text: "Algebra matches.",
    courses: [{ id: courseId, title: "Algebra" }],
  });
}

function embedResponse() {
  return new Response(JSON.stringify({ embeddings: [Array.from({ length: 768 }, () => 0.5)] }), {
    status: 200,
  });
}

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function waitForAbort(signal?: AbortSignal | null): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    signal?.addEventListener("abort", () => reject(abortError()), { once: true });
  });
}

function abortError() {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function sequential(responses: Response[]): typeof fetch {
  return async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected model call");
    return next;
  };
}
