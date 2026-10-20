import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { embeddingLiteral } from "../supabase/functions/_shared/embeddings.ts";
import {
  loadStoredChunks,
  readSeedEnv,
  readSeedRunOptions,
  runRagSeed,
  type RagSeedDb,
} from "../supabase/functions/_shared/rag-seed.ts";

loadLocalEnv();

const missingTableMessage = "rag_chunks is not available. Apply the RAG migration first.";

const env = readSeedEnv(process.env);
if (!env.ok) {
  console.error(env.message);
  process.exit(1);
}

const db = createClient(env.url, env.key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const seedDb: RagSeedDb = {
  async courses() {
    const { data, error } = await db.from("courses").select("id, title, description");
    if (error) return { ok: false, message: missingTableMessage };
    const rows = Array.isArray(data) ? data : [];
    return {
      ok: true,
      rows: rows.filter(isRecord).map((row) => ({
        id: text(row, "id") ?? "",
        title: text(row, "title"),
        description: text(row, "description"),
      })),
    };
  },
  async lessons() {
    const { data, error } = await db.from("lessons").select("id, course_id, title, content");
    if (error) return { ok: false, message: missingTableMessage };
    const rows = Array.isArray(data) ? data : [];
    return {
      ok: true,
      rows: rows
        .filter(isRecord)
        .map((row) => ({
          id: text(row, "id") ?? "",
          courseId: text(row, "course_id") ?? "",
          title: text(row, "title"),
          content: text(row, "content"),
        }))
        .filter((row) => row.id && row.courseId),
    };
  },
  async chunks() {
    return loadStoredChunks(async (from, to) => {
      const { data, error } = await db
        .from("rag_chunks")
        .select("source_key, title, body")
        .order("source_key", { ascending: true })
        .range(from, to);
      if (error) return { ok: false, message: missingTableMessage };
      const rows = Array.isArray(data) ? data : [];
      return {
        ok: true,
        rows: rows.filter(isRecord).flatMap((row) => {
          const sourceKey = text(row, "source_key");
          const body = text(row, "body");
          if (!sourceKey || body === null) return [];
          return [{ sourceKey, title: text(row, "title"), body }];
        }),
      };
    });
  },
  async upsert(rows) {
    const { error } = await db.from("rag_chunks").upsert(
      rows.map((row) => ({
        source_type: row.sourceType,
        source_key: row.sourceKey,
        course_id: row.courseId,
        lesson_id: row.lessonId,
        title: row.title,
        body: row.body,
        embedding: embeddingLiteral(row.embedding),
      })),
      { onConflict: "source_key" },
    );
    if (error) return { ok: false, message: missingTableMessage };
    return { ok: true };
  },
};

const result = await runRagSeed({
  geminiKey: env.gemini,
  db: seedDb,
  fetchImpl: fetch,
  ...readSeedRunOptions(process.env),
});
if (!result.ok) {
  console.error(result.message);
  if ("embedded" in result) {
    console.error(
      `Embedded this run: ${result.embedded}. Unchanged: ${result.unchanged}. Existing rows were kept.`,
    );
  }
  process.exit(1);
}

console.log(
  `FAQ chunks: ${result.faqCount}. Catalogue chunks: ${result.catalogueCount}. Embedded this run: ${result.embedded}. Unchanged: ${result.unchanged}. Record target: ${readSeedRunOptions(process.env).recordLimit}.`,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function loadLocalEnv() {
  try {
    const file = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const name = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[name] === undefined) process.env[name] = value;
    }
  } catch {
    // The shell environment is enough when no local env file is present.
  }
}
