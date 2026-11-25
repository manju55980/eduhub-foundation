import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  embeddingLiteral,
  embedTextsWithOllama,
} from "../supabase/functions/_shared/embeddings.ts";
import { failedAiMessage } from "../supabase/functions/_shared/gemini.ts";
import {
  answerRelevance,
  faithfulness,
  fuseChunks,
  hybridCandidateLimit,
  hybridResultLimit,
  keywordQuery,
  lexicalAnswer,
  meanContextPrecision,
  meanScore,
  type HybridChunk,
} from "../supabase/functions/_shared/hybrid-search.ts";
import {
  hitAt5,
  mrrAt5,
  sourceKeyFromMatch,
  type RagEvalQuery,
  type RagHit,
} from "../supabase/functions/_shared/rag-evaluation.ts";
import { readSeedEnv } from "../supabase/functions/_shared/rag-seed.ts";
import { isServiceRoleKey } from "../supabase/functions/_shared/user-client.ts";

loadLocalEnv();

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(root, "scripts/fixtures/rag-queries.json");
const reportPath = resolve(root, "docs/assessment-4/hybrid-rag.md");

const env = readSeedEnv(process.env);
if (!env.ok) {
  console.error(env.message);
  process.exit(1);
}
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";
if (!publishableKey || isServiceRoleKey(publishableKey)) {
  console.error("The publishable key is required so retrieval runs with RLS.");
  process.exit(1);
}

const queries = JSON.parse(readFileSync(fixturePath, "utf8")) as RagEvalQuery[];
const session = await openStudentSession(env.url, env.key, publishableKey);
if (!session.ok) {
  console.error(session.message);
  process.exit(1);
}

const rows: QueryScore[] = [];
const batchSize = 8;
for (let index = 0; index < queries.length; index += batchSize) {
  if (index > 0) await delay(1000);
  const batch = queries.slice(index, index + batchSize);
  const embedded = await embedTextsWithOllama(
    {
      host: env.ollamaHost,
      texts: batch.map((query) => query.query),
      taskType: "RETRIEVAL_QUERY",
      maxAttempts: 1,
    },
    fetch,
  );
  if (!embedded.ok) {
    console.error(embedded.message);
    console.error("The hybrid report was not written.");
    process.exit(1);
  }

  for (let offset = 0; offset < batch.length; offset += 1) {
    const query = batch[offset];
    const vector = embedded.vectors[offset];
    if (!query || !vector) {
      console.error(failedAiMessage);
      console.error("The hybrid report was not written.");
      process.exit(1);
    }
    const scored = await scoreQuery(session.client, query, vector);
    if (!scored.ok) {
      console.error(scored.message);
      console.error("The hybrid report was not written.");
      process.exit(1);
    }
    rows.push(scored.row);
  }
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, renderReport(rows), "utf8");
console.log(`Wrote ${rows.length} queries to docs/assessment-4/hybrid-rag.md.`);

type QueryScore = {
  set: RagEvalQuery["set"];
  expected: string[];
  vectorHits: RagHit[];
  hybridHits: RagHit[];
  vectorKeys: string[];
  hybridKeys: string[];
  vectorFaithfulness: number;
  hybridFaithfulness: number;
  vectorRelevance: number;
  hybridRelevance: number;
};

async function scoreQuery(client: SupabaseClient, query: RagEvalQuery, vector: number[]) {
  const literal = embeddingLiteral(vector);
  const keywords = keywordQuery(query.query);
  const vectorRows = await readRows(client, "match_knowledge", {
    query_embedding: literal,
    match_count: hybridCandidateLimit,
  });
  if (!vectorRows.ok) return vectorRows;
  const textRows = await readRows(client, "search_knowledge_text", {
    query_text: keywords,
    match_count: hybridCandidateLimit,
  });
  const text = textRows.ok ? textRows.rows : [];
  const fused = fuseChunks(vectorRows.rows, text, keywords);
  return {
    ok: true as const,
    row: {
      set: query.set,
      expected: query.expected_source_keys,
      vectorHits: toHits(vectorRows.rows).slice(0, hybridResultLimit),
      hybridHits: toHits(fused).slice(0, hybridResultLimit),
      vectorKeys: sourceKeys(vectorRows.rows).slice(0, hybridResultLimit),
      hybridKeys: sourceKeys(fused).slice(0, hybridResultLimit),
      vectorFaithfulness: scoreAnswer(query.query, vectorRows.rows.slice(0, hybridResultLimit))
        .faithfulness,
      hybridFaithfulness: scoreAnswer(query.query, fused.slice(0, hybridResultLimit)).faithfulness,
      vectorRelevance: scoreAnswer(query.query, vectorRows.rows.slice(0, hybridResultLimit))
        .relevance,
      hybridRelevance: scoreAnswer(query.query, fused.slice(0, hybridResultLimit)).relevance,
    },
  };
}

function scoreAnswer(query: string, rows: HybridChunk[]) {
  const contexts = rows.map((row) => `${row.title ?? ""} ${row.body ?? ""}`.trim()).filter(Boolean);
  const answer = lexicalAnswer(query, contexts);
  return {
    faithfulness: faithfulness(answer, contexts),
    relevance: answerRelevance(query, answer),
  };
}

async function readRows(
  client: SupabaseClient,
  fn: "match_knowledge" | "search_knowledge_text",
  args: Record<string, string | number>,
) {
  const { data, error } = await client.rpc(fn, args);
  if (error) return { ok: false as const, message: error.message };
  const rows = Array.isArray(data) ? data.flatMap(toChunk) : [];
  return { ok: true as const, rows };
}

function toChunk(row: unknown): HybridChunk[] {
  if (!row || typeof row !== "object") return [];
  const record = row as Record<string, unknown>;
  if (typeof record.id !== "string") return [];
  return [
    {
      id: record.id,
      sourceType: typeof record.source_type === "string" ? record.source_type : null,
      title: typeof record.title === "string" ? record.title : null,
      body: typeof record.body === "string" ? record.body : null,
      courseId: typeof record.course_id === "string" ? record.course_id : null,
      similarity: typeof record.similarity === "number" ? record.similarity : null,
    },
  ];
}

function sourceKeys(rows: HybridChunk[]) {
  return rows.map((row) =>
    sourceKeyFromMatch({
      sourceType: row.sourceType ?? "",
      body: row.body ?? "",
      courseId: row.courseId,
    }),
  );
}

function toHits(rows: HybridChunk[]): RagHit[] {
  return rows.map((row) => ({
    sourceKey: sourceKeys([row])[0] ?? "",
    similarity: row.similarity ?? 0,
  }));
}

function renderReport(rows: QueryScore[]) {
  const sets: Array<RagEvalQuery["set"] | "all"> = ["matching", "noisy", "extreme", "all"];
  const lines = [
    "# Hybrid retrieval",
    "",
    "Same 90 queries as `docs/assessment-2/rag-evaluation.md`. Vector is the first 5 rows from `match_knowledge`. Hybrid is the first 5 rows after the rank merge with `search_knowledge_text`.",
    "",
    "Faithfulness and answer relevance use an answer copied from the retrieved text. They are lexical stand-ins, not a model judge. Context precision is the average precision of the expected key inside the top 5.",
    "",
    "| Set | Queries | Vector Hit@5 | Hybrid Hit@5 | Vector MRR@5 | Hybrid MRR@5 | Vector precision | Hybrid precision | Vector faithfulness | Hybrid faithfulness | Vector relevance | Hybrid relevance |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const set of sets) {
    const group = set === "all" ? rows : rows.filter((row) => row.set === set);
    lines.push(
      `| ${label(set)} | ${group.length} | ${fmt(hitAt5(asHits(group, "vector")))} | ${fmt(hitAt5(asHits(group, "hybrid")))} | ${fmt(mrrAt5(asHits(group, "vector")))} | ${fmt(mrrAt5(asHits(group, "hybrid")))} | ${fmt(meanContextPrecision(asKeys(group, "vector")))} | ${fmt(meanContextPrecision(asKeys(group, "hybrid")))} | ${fmt(meanScore(group.map((row) => row.vectorFaithfulness)))} | ${fmt(meanScore(group.map((row) => row.hybridFaithfulness)))} | ${fmt(meanScore(group.map((row) => row.vectorRelevance)))} | ${fmt(meanScore(group.map((row) => row.hybridRelevance)))} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function asHits(rows: QueryScore[], kind: "vector" | "hybrid") {
  return rows.map((row) => ({
    expected: row.expected,
    hits: kind === "vector" ? row.vectorHits : row.hybridHits,
  }));
}

function asKeys(rows: QueryScore[], kind: "vector" | "hybrid") {
  return rows.map((row) => ({
    expected: row.expected,
    sourceKeys: kind === "vector" ? row.vectorKeys : row.hybridKeys,
  }));
}

function label(set: RagEvalQuery["set"] | "all") {
  if (set === "all") return "All";
  return set.charAt(0).toUpperCase() + set.slice(1);
}

function fmt(value: number) {
  return value.toFixed(3);
}

async function openStudentSession(url: string, serviceKey: string, publishable: string) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const profile = await admin.from("profiles").select("id").eq("role", "student").limit(1);
  const studentId = profile.data?.[0]?.id;
  if (profile.error || !studentId) {
    return { ok: false as const, message: "A student profile is required." };
  }
  const user = await admin.auth.admin.getUserById(studentId);
  const email = user.data.user?.email;
  if (!email) return { ok: false as const, message: "Could not open a student session." };
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) {
    return { ok: false as const, message: "Could not open a student session." };
  }
  const client = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verified.error || !verified.data.session) {
    return { ok: false as const, message: "Could not open a student session." };
  }
  return { ok: true as const, client };
}

function delay(ms: number) {
  return new Promise<void>((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
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
