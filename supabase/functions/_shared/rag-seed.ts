import { embedTextsWithRetry } from "./embeddings.ts";
import { failedAiMessage, missingAiMessage } from "./gemini.ts";
import {
  courseChunk,
  faqChunks,
  lessonChunk,
  planChunkWrites,
  type RagChunkDraft,
} from "./rag-corpus.ts";
import { isServiceRoleKey } from "./user-client.ts";

export const seedPageSize = 1000;
export const seedBatchLimit = 32;
export const seedDelayLimitMs = 60_000;

const defaultBatchSize = 8;
const defaultDelayMs = 1000;
const defaultMaxAttempts = 4;
const defaultRecordLimit = 300;
const recordLimitMax = 10000;

export type StoredChunk = {
  sourceKey: string;
  title: string | null;
  body: string;
};

export type RagSeedDb = {
  courses: () => Promise<
    | { ok: true; rows: Array<{ id: string; title: string | null; description: string | null }> }
    | { ok: false; message: string }
  >;
  lessons: () => Promise<
    | {
        ok: true;
        rows: Array<{ id: string; courseId: string; title: string | null; content: string | null }>;
      }
    | { ok: false; message: string }
  >;
  chunks: () => Promise<{ ok: true; rows: StoredChunk[] } | { ok: false; message: string }>;
  upsert: (
    rows: Array<RagChunkDraft & { embedding: number[] }>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export type SeedRunOptions = {
  batchSize?: number;
  delayMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
};

export function readSeedEnv(env: Record<string, string | undefined>) {
  const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const gemini = env.GEMINI_API_KEY?.trim() ?? "";
  if (!gemini) return { ok: false as const, message: missingAiMessage };
  if (!url || !isServiceRoleKey(key)) {
    return { ok: false as const, message: "The service role key is required." };
  }
  return { ok: true as const, url, key, gemini };
}

export function readSeedRunOptions(env: Record<string, string | undefined>) {
  return {
    batchSize: boundedInt(env.RAG_EMBED_BATCH_SIZE, defaultBatchSize, 1, seedBatchLimit),
    delayMs: boundedInt(env.RAG_EMBED_DELAY_MS, defaultDelayMs, 0, seedDelayLimitMs),
    maxAttempts: boundedInt(env.RAG_EMBED_MAX_ATTEMPTS, defaultMaxAttempts, 1, 6),
    recordLimit: boundedInt(env.RAG_EMBED_RECORD_LIMIT, defaultRecordLimit, 1, recordLimitMax),
  };
}

export async function loadStoredChunks(
  loadPage: (
    from: number,
    to: number,
  ) => Promise<{ ok: true; rows: StoredChunk[] } | { ok: false; message: string }>,
  pageSize = seedPageSize,
) {
  const rows: StoredChunk[] = [];
  let from = 0;
  for (;;) {
    const page = await loadPage(from, from + pageSize - 1);
    if (!page.ok) return page;
    rows.push(...page.rows);
    if (page.rows.length < pageSize) return { ok: true as const, rows };
    from += pageSize;
  }
}

export async function runRagSeed(options: {
  geminiKey: string | undefined;
  db: RagSeedDb;
  fetchImpl: typeof fetch;
  batchSize?: number;
  delayMs?: number;
  maxAttempts?: number;
  recordLimit?: number;
  sleep?: (ms: number) => Promise<void>;
}) {
  const courses = await options.db.courses();
  if (!courses.ok) return courses;
  const lessons = await options.db.lessons();
  if (!lessons.ok) return lessons;
  const stored = await options.db.chunks();
  if (!stored.ok) return stored;

  const next = [...courses.rows.map(courseChunk), ...lessons.rows.map(lessonChunk), ...faqChunks()];
  const pending = planChunkWrites(
    stored.rows.map((row) => ({
      sourceType: "faq" as const,
      sourceKey: row.sourceKey,
      courseId: null,
      lessonId: null,
      title: row.title ?? "",
      body: row.body,
    })),
    next,
  );
  const batchSize = boundedInt(options.batchSize, defaultBatchSize, 1, seedBatchLimit);
  const delayMs = boundedInt(options.delayMs, 0, 0, seedDelayLimitMs);
  const maxAttempts = boundedInt(options.maxAttempts, defaultMaxAttempts, 1, 6);
  const sleep = options.sleep ?? delay;

  let embedded = 0;
  const unchanged = next.length - pending.length;
  const queue = selectSeedQueue(pending, unchanged, options.recordLimit);
  for (let index = 0; index < queue.length; index += batchSize) {
    if (index > 0 && delayMs > 0) await sleep(delayMs);
    const batch = queue.slice(index, index + batchSize);
    const vectors = await embedTextsWithRetry(
      {
        apiKey: options.geminiKey,
        texts: batch.map((chunk) => chunk.body),
        taskType: "RETRIEVAL_DOCUMENT",
        maxAttempts,
        baseDelayMs: delayMs,
        sleep,
      },
      options.fetchImpl,
    );
    if (!vectors.ok) {
      return { ok: false as const, message: vectors.message, embedded, unchanged };
    }
    const rows = batch.map((chunk, offset) => {
      const embedding = vectors.vectors[offset];
      if (!embedding) return null;
      return { ...chunk, embedding };
    });
    if (rows.some((row) => !row)) {
      return { ok: false as const, message: failedAiMessage, embedded, unchanged };
    }
    const written = await options.db.upsert(
      rows.filter((row): row is RagChunkDraft & { embedding: number[] } => Boolean(row)),
    );
    if (!written.ok) return { ...written, embedded, unchanged };
    embedded += batch.length;
  }

  return {
    ok: true as const,
    faqCount: next.filter((chunk) => chunk.sourceType === "faq").length,
    catalogueCount: next.length - next.filter((chunk) => chunk.sourceType === "faq").length,
    embedded,
    unchanged,
  };
}

function selectSeedQueue<T extends { sourceType: string }>(
  pending: T[],
  unchanged: number,
  recordLimit: number | undefined,
) {
  if (recordLimit === undefined) return pending;
  const catalogue = pending.filter((chunk) => chunk.sourceType !== "faq");
  const faqs = pending.filter((chunk) => chunk.sourceType === "faq");
  const faqRoom = Math.max(0, recordLimit - unchanged - catalogue.length);
  return [...catalogue, ...faqs.slice(0, faqRoom)];
}

function boundedInt(
  value: number | string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(value)));
  }
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
