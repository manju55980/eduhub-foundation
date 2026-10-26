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
  evaluationGroups,
  renderRagReport,
  sourceKeyFromMatch,
  type RagEvalQuery,
  type RagHit,
} from "../supabase/functions/_shared/rag-evaluation.ts";
import { readSeedEnv } from "../supabase/functions/_shared/rag-seed.ts";
import { isServiceRoleKey } from "../supabase/functions/_shared/user-client.ts";

loadLocalEnv();

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(root, "scripts/fixtures/rag-queries.json");
const reportPath = resolve(root, "docs/assessment-2/rag-evaluation.md");

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
const corpusSize = await countEmbeddedChunks(env.url, env.key);
if (!corpusSize.ok) {
  console.error(corpusSize.message);
  process.exit(1);
}
const session = await openStudentSession(env.url, env.key, publishableKey);
if (!session.ok) {
  console.error(session.message);
  process.exit(1);
}

const hits = new Map<string, RagHit[]>();
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
    console.error("The retrieval report was not written.");
    process.exit(1);
  }

  for (let offset = 0; offset < batch.length; offset += 1) {
    const query = batch[offset];
    const vector = embedded.vectors[offset];
    if (!query || !vector) {
      console.error(failedAiMessage);
      console.error("The retrieval report was not written.");
      process.exit(1);
    }
    const matched = await matchKnowledge(session.client, vector);
    if (!matched.ok) {
      console.error(matched.message);
      console.error("The retrieval report was not written.");
      process.exit(1);
    }
    hits.set(query.id, matched.hits);
  }
}

const faqCount = await countEmbeddedFaqs(env.url, env.key);
if (!faqCount.ok) {
  console.error(faqCount.message);
  process.exit(1);
}
const report = renderRagReport(evaluationGroups(queries, hits), corpusSize.count, faqCount.count);
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, report, "utf8");
console.log(`Wrote ${queries.length} queries to docs/assessment-2/rag-evaluation.md.`);

async function countEmbeddedChunks(url: string, serviceKey: string) {
  return countChunks(url, serviceKey, false);
}

async function countEmbeddedFaqs(url: string, serviceKey: string) {
  return countChunks(url, serviceKey, true);
}

async function countChunks(url: string, serviceKey: string, faqsOnly: boolean) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let query = admin
    .from("rag_chunks")
    .select("id", { count: "exact", head: true })
    .not("embedding", "is", null);
  if (faqsOnly) query = query.eq("source_type", "faq");
  const { count, error } = await query;
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, count: count ?? 0 };
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

async function matchKnowledge(client: SupabaseClient, vector: number[]) {
  const { data, error } = await client.rpc("match_knowledge", {
    query_embedding: embeddingLiteral(vector),
    match_count: 10,
  });
  if (error) return { ok: false as const, message: error.message };
  const rows = Array.isArray(data) ? data : [];
  const hits: RagHit[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const similarity = record.similarity;
    if (typeof similarity !== "number") continue;
    hits.push({
      sourceKey: sourceKeyFromMatch({
        sourceType: typeof record.source_type === "string" ? record.source_type : "",
        body: typeof record.body === "string" ? record.body : "",
        courseId: typeof record.course_id === "string" ? record.course_id : null,
      }),
      similarity,
    });
  }
  return { ok: true as const, hits };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
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
