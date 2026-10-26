export type CachedEmbedding = {
  sourceKey: string;
  bodyHash: string;
  embedding: number[];
};

export async function hashBody(body: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseEmbeddingCache(contents: string) {
  const rows = new Map<string, CachedEmbedding>();
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<CachedEmbedding>;
      if (typeof parsed.sourceKey !== "string" || typeof parsed.bodyHash !== "string") continue;
      if (
        !Array.isArray(parsed.embedding) ||
        parsed.embedding.some((value) => typeof value !== "number")
      ) {
        continue;
      }
      rows.set(parsed.sourceKey, {
        sourceKey: parsed.sourceKey,
        bodyHash: parsed.bodyHash,
        embedding: parsed.embedding,
      });
    } catch {
      // A partial last line is ignored so a resumed run can keep earlier vectors.
    }
  }
  return rows;
}

export function embeddingCacheLine(row: CachedEmbedding) {
  return JSON.stringify(row);
}
