export const hybridCandidateLimit = 10;
export const hybridResultLimit = 5;
const rrfK = 60;
const wordBoost = 0.02;
const wordBoostCap = 5;

export type HybridChunk = {
  id: string;
  sourceType: string | null;
  title: string | null;
  body: string | null;
  courseId: string | null;
  similarity: number | null;
};

export function keywordQuery(text: string) {
  const words = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const unique: string[] = [];
  for (const word of words) {
    if (unique.includes(word)) continue;
    unique.push(word);
    if (unique.length === 8) break;
  }
  return unique.join(" or ");
}

export function fuseChunks<T extends HybridChunk>(vector: T[], text: T[], query: string): T[] {
  const scores = new Map<string, { row: T; score: number; inVector: boolean; inText: boolean }>();

  function add(rows: T[], fromVector: boolean) {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (!row.id || seen.has(row.id)) return;
      seen.add(row.id);
      const current = scores.get(row.id) ?? {
        row,
        score: 0,
        inVector: false,
        inText: false,
      };
      current.score += 1 / (rrfK + index + 1);
      if (fromVector) {
        current.inVector = true;
        current.row = { ...current.row, similarity: row.similarity };
      } else {
        current.inText = true;
        if (!current.inVector) current.row = row;
      }
      scores.set(row.id, current);
    });
  }

  add(vector, true);
  add(text, false);

  const words = new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const ranked = [...scores.values()];
  for (const item of ranked) {
    if (!item.inVector || !item.inText || words.size === 0) continue;
    const haystack = `${item.row.title ?? ""} ${item.row.body ?? ""}`.toLowerCase();
    let shared = 0;
    for (const word of words) {
      if (haystack.includes(word)) shared += 1;
    }
    item.score += Math.min(shared, wordBoostCap) * wordBoost;
  }

  ranked.sort((left, right) => right.score - left.score || left.row.id.localeCompare(right.row.id));
  return ranked.map((item) => item.row);
}

export function contextPrecision(
  expected: string[],
  sourceKeys: string[],
  cutoff = hybridResultLimit,
) {
  if (expected.length === 0) return null;
  const top = sourceKeys.slice(0, cutoff);
  let relevant = 0;
  let precision = 0;
  for (let index = 0; index < top.length; index += 1) {
    const key = top[index];
    if (!key || !expected.includes(key)) continue;
    relevant += 1;
    precision += relevant / (index + 1);
  }
  return relevant === 0 ? 0 : precision / relevant;
}

export function meanContextPrecision(rows: Array<{ expected: string[]; sourceKeys: string[] }>) {
  const scored = rows
    .map((row) => contextPrecision(row.expected, row.sourceKeys))
    .filter((value): value is number => value !== null);
  if (scored.length === 0) return 0;
  return scored.reduce((sum, value) => sum + value, 0) / scored.length;
}

export function lexicalAnswer(query: string, contexts: string[]) {
  const words = new Set(contentWords(query));
  const sentences = contexts.flatMap(sentencesOf);
  const picked = sentences.filter((sentence) =>
    contentWords(sentence).some((word) => words.has(word)),
  );
  const used = picked.length > 0 ? picked : sentences;
  return used.slice(0, 2).join(" ");
}

export function faithfulness(answer: string, contexts: string[]) {
  const claims = sentencesOf(answer);
  if (claims.length === 0) return 0;
  const contextWords = new Set(contentWords(contexts.join(" ")));
  const supported = claims.filter((claim) => {
    const words = contentWords(claim);
    return words.length === 0 || words.every((word) => contextWords.has(word));
  }).length;
  return supported / claims.length;
}

export function answerRelevance(query: string, answer: string) {
  const queryWords = contentWords(query);
  if (queryWords.length === 0) return 0;
  const answerWords = new Set(contentWords(answer));
  const shared = queryWords.filter((word) => answerWords.has(word)).length;
  return shared / queryWords.length;
}

export function meanScore(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sentencesOf(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function contentWords(text: string) {
  return text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
}
