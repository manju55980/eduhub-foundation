import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyEmbedFailure,
  embedBackoffMs,
  embeddingDimensions,
  embeddingQuotaMessage,
  embedTextsWithRetry,
  retryAfterHeaderMs,
} from "../../supabase/functions/_shared/embeddings.ts";
import { faqChunks } from "../../supabase/functions/_shared/rag-corpus.ts";
import {
  loadStoredChunks,
  readSeedRunOptions,
  runRagSeed,
  seedPageSize,
} from "../../supabase/functions/_shared/rag-seed.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const quotaBody = JSON.stringify({
  error: {
    code: 429,
    message: "You exceeded your current quota, please check your plan and billing details.",
    status: "RESOURCE_EXHAUSTED",
  },
});
const rateLimitBody = JSON.stringify({
  error: {
    code: 429,
    message: "Resource exhausted. Please try again later.",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "2s" }],
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Gemini 429 classification", () => {
  it("treats the billing quota message as exhausted quota", () => {
    expect(classifyEmbedFailure(429, quotaBody)).toEqual({ kind: "quota", retryAfterMs: null });
  });

  it("treats a 429 with retry delay as a rate limit and a 5xx as transient", () => {
    expect(classifyEmbedFailure(429, rateLimitBody)).toEqual({
      kind: "rate_limit",
      retryAfterMs: 2000,
    });
    expect(classifyEmbedFailure(503, "unavailable").kind).toBe("server");
    expect(classifyEmbedFailure(400, quotaBody).kind).toBe("fatal");
    expect(retryAfterHeaderMs("2")).toBe(2000);
    expect(embedBackoffMs(0, 0, null)).toBe(500);
    expect(embedBackoffMs(0, 0, 90_000)).toBe(30_000);
  });
});

describe("embedding retry", () => {
  it("does not retry an exhausted quota", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async () => new Response(quotaBody, { status: 429 }));
    const sleep = vi.fn(async () => undefined);

    const result = await embedTextsWithRetry(
      {
        apiKey: "test-key",
        texts: ["lesson"],
        taskType: "RETRIEVAL_DOCUMENT",
        maxAttempts: 4,
        baseDelayMs: 0,
        sleep,
      },
      fetchImpl,
    );

    expect(result).toMatchObject({ ok: false, message: embeddingQuotaMessage, kind: "quota" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a rate-limit 429 and a 5xx with bounded backoff", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const responses = [
      new Response(rateLimitBody, { status: 429, headers: { "retry-after": "2" } }),
      geminiEmbedResponse(1),
    ];
    const fetchImpl = vi.fn(async () => responses.shift() ?? new Response("no", { status: 500 }));
    const sleep = vi.fn(async () => undefined);

    const result = await embedTextsWithRetry(
      {
        apiKey: "AIzaSyTESTKEY123456789012",
        texts: ["lesson"],
        taskType: "RETRIEVAL_DOCUMENT",
        maxAttempts: 4,
        baseDelayMs: 0,
        sleep,
      },
      fetchImpl,
    );

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("AIzaSyTESTKEY123456789012");

    const serverResponses = [
      new Response("down", { status: 503 }),
      new Response("down", { status: 502 }),
    ];
    const serverFetch = vi.fn(
      async () => serverResponses.shift() ?? new Response("down", { status: 500 }),
    );
    const serverSleep = vi.fn(async () => undefined);
    const failed = await embedTextsWithRetry(
      {
        apiKey: "test-key",
        texts: ["lesson"],
        taskType: "RETRIEVAL_DOCUMENT",
        maxAttempts: 2,
        baseDelayMs: 0,
        sleep: serverSleep,
      },
      serverFetch,
    );
    expect(failed).toMatchObject({ ok: false, kind: "server" });
    expect(serverFetch).toHaveBeenCalledTimes(2);
    expect(serverSleep).toHaveBeenCalledTimes(1);
    expect(serverSleep).toHaveBeenCalledWith(500);
  });
});

describe("resumable rag seed", () => {
  it("reads stored chunks page by page and keeps the configured bounds", async () => {
    const pages = [
      [
        { sourceKey: "faq:0001", title: "A", body: "A" },
        { sourceKey: "faq:0002", title: "B", body: "B" },
      ],
      [{ sourceKey: "faq:0003", title: "C", body: "C" }],
    ];
    const ranges: Array<[number, number]> = [];
    const loaded = await loadStoredChunks(async (from, to) => {
      ranges.push([from, to]);
      const rows = pages.shift() ?? [];
      return { ok: true, rows };
    }, 2);

    expect(loaded).toMatchObject({ ok: true });
    if (!loaded.ok) return;
    expect(loaded.rows.map((row) => row.sourceKey)).toEqual(["faq:0001", "faq:0002", "faq:0003"]);
    expect(ranges).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(readSeedRunOptions({})).toEqual({
      batchSize: 8,
      delayMs: 1000,
      maxAttempts: 4,
      recordLimit: 300,
      replaceExisting: false,
      writeChunks: true,
    });
    expect(
      readSeedRunOptions({ RAG_EMBED_BATCH_SIZE: "100", RAG_EMBED_DELAY_MS: "0" }),
    ).toMatchObject({
      batchSize: 32,
      delayMs: 0,
    });
    expect(seedPageSize).toBe(1000);
  });

  it("skips unchanged rows, pauses between batches, and keeps rows written before quota stops the run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const faqs = faqChunks();
    const stored = faqs.map((chunk, index) =>
      index === 0
        ? { sourceKey: chunk.sourceKey, title: chunk.title, body: `${chunk.body} edited` }
        : {
            sourceKey: chunk.sourceKey,
            title: chunk.title,
            body: chunk.body,
          },
    );
    const upsert = vi.fn(async () => ({ ok: true as const }));
    const sleep = vi.fn(async () => undefined);
    const responses = [embedResponse(1), new Response(quotaBody, { status: 429 })];

    const result = await runRagSeed({
      geminiKey: "test-key",
      batchSize: 1,
      delayMs: 25,
      maxAttempts: 2,
      sleep,
      fetchImpl: async () => responses.shift() ?? new Response(quotaBody, { status: 429 }),
      db: {
        courses: async () => ({
          ok: true,
          rows: [{ id: "course-1", title: "Algebra", description: "Numbers" }],
        }),
        lessons: async () => ({ ok: true, rows: [] }),
        chunks: async () => ({ ok: true, rows: stored }),
        upsert,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      message: embeddingQuotaMessage,
      embedded: 1,
      unchanged: 4999,
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toMatchObject([{ sourceKey: "course:course-1" }]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(25);

    const pauses: number[] = [];
    const resumed = await runRagSeed({
      geminiKey: "test-key",
      batchSize: 1,
      delayMs: 25,
      maxAttempts: 1,
      sleep: async (ms) => {
        pauses.push(ms);
      },
      fetchImpl: async () => embedResponse(1),
      db: {
        courses: async () => ({
          ok: true,
          rows: [
            { id: "course-1", title: "Algebra", description: "Numbers" },
            { id: "course-2", title: "Geometry", description: "Shapes" },
          ],
        }),
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

    expect(resumed).toMatchObject({ ok: true, embedded: 2, unchanged: 5000 });
    expect(pauses).toEqual([25]);
    const writtenKeys = upsert.mock.calls
      .slice(1)
      .flatMap((call) => call[0].map((row) => row.sourceKey));
    expect(writtenKeys).toEqual(["course:course-1", "course:course-2"]);
    expect(writtenKeys.some((key) => key.startsWith("faq:"))).toBe(false);

    const seed = readFileSync(resolve(root, "scripts/seed-rag-chunks.ts"), "utf8");
    const runner = readFileSync(resolve(root, "supabase/functions/_shared/rag-seed.ts"), "utf8");
    expect(seed).toContain("readSeedRunOptions(process.env)");
    expect(runner).toContain("RAG_EMBED_BATCH_SIZE");
    expect(runner).toContain("RAG_EMBED_DELAY_MS");
    expect(runner).toContain("RAG_EMBED_MAX_ATTEMPTS");
    expect(runner).toContain("RAG_EMBED_RECORD_LIMIT");
    expect(seed).not.toMatch(/console\.(log|error)\([^)]*env\.(key|gemini)/);
  });

  it("embeds every catalogue chunk before FAQ rows and stops near the record limit", async () => {
    const upsert = vi.fn(async () => ({ ok: true as const }));
    const result = await runRagSeed({
      geminiKey: "test-key",
      batchSize: 10,
      delayMs: 0,
      maxAttempts: 1,
      recordLimit: 4,
      sleep: async () => undefined,
      fetchImpl: async () => embedResponse(4),
      db: {
        courses: async () => ({
          ok: true,
          rows: [{ id: "course-1", title: "Algebra", description: "Numbers" }],
        }),
        lessons: async () => ({
          ok: true,
          rows: [{ id: "lesson-1", courseId: "course-1", title: "Halves", content: "Split" }],
        }),
        chunks: async () => ({ ok: true, rows: [] }),
        upsert,
      },
    });

    expect(result).toMatchObject({ ok: true, embedded: 4, unchanged: 0 });
    expect(upsert.mock.calls[0]?.[0].map((row) => row.sourceKey)).toEqual([
      "course:course-1",
      "lesson:lesson-1",
      "faq:0001",
      "faq:0002",
    ]);
  });

  it("rewrites unchanged rows when replacing the embedding model and can cache without writing", async () => {
    const faqs = faqChunks();
    const upsert = vi.fn(async () => ({ ok: true as const }));
    const cached: string[] = [];
    const result = await runRagSeed({
      ollamaHost: "http://127.0.0.1:11434",
      batchSize: 10,
      delayMs: 0,
      maxAttempts: 1,
      recordLimit: 3,
      replaceExisting: true,
      writeChunks: false,
      sleep: async () => undefined,
      fetchImpl: async () => embedResponse(3),
      onCache: (row) => cached.push(row.sourceKey),
      db: {
        courses: async () => ({
          ok: true,
          rows: [{ id: "course-1", title: "Algebra", description: "Numbers" }],
        }),
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

    expect(result).toMatchObject({ ok: true, embedded: 3, unchanged: 0 });
    expect(upsert).not.toHaveBeenCalled();
    expect(cached).toEqual(["course:course-1", "faq:0001", "faq:0002"]);
  });
});

function geminiEmbedResponse(count: number) {
  return new Response(
    JSON.stringify({
      embeddings: Array.from({ length: count }, () => ({
        values: Array.from({ length: embeddingDimensions }, () => 0.25),
      })),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function embedResponse(count: number) {
  const vector = Array.from({ length: embeddingDimensions }, () => 0.25);
  return new Response(JSON.stringify({ embeddings: Array.from({ length: count }, () => vector) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
