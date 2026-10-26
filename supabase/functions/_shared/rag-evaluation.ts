import { faqChunks } from "./rag-corpus.ts";

export const retrievalCutoff = 5;
export const extremeRejectionThreshold = 0.75;
export const embeddingModelName = "nomic-embed-text";
export const embeddingDimensionCount = 768;

export type RagQuerySet = "matching" | "noisy" | "extreme";

export type RagEvalQuery = {
  id: string;
  set: RagQuerySet;
  query: string;
  expected_source_keys: string[];
  pair_id?: string;
};

export type RagHit = {
  sourceKey: string;
  similarity: number;
};

const junkToken = "zxqvjunk";

const outOfCorpus = [
  "Which metal has atomic number 79?",
  "Name the largest moon of Jupiter.",
  "Who painted the ceiling of the Sistine Chapel?",
  "What is the boiling point of ethanol in degrees Celsius?",
  "Which river flows through Cairo?",
  "How many strings does a standard violin have?",
  "What year did the first powered airplane fly?",
  "Which planet has the shortest orbit around the sun?",
  "Name the currency used in Japan.",
  "What instrument measures atmospheric pressure?",
  "Which ocean borders the west coast of Portugal?",
  "How many players are on a volleyball team on the court?",
  "What is the chemical symbol for tungsten?",
  "Which city hosted the 1960 Summer Olympics?",
  "Name the author of One Hundred Years of Solitude.",
];

export function isAcceptedExpectedKey(key: string) {
  return /^faq:\d{4}$/.test(key) || /^course:[0-9a-f-]{36}$/i.test(key);
}

export function sourceKeyFromMatch(row: {
  sourceType: string;
  body: string;
  courseId: string | null;
}) {
  if (row.sourceType === "course" && row.courseId) return `course:${row.courseId}`;
  if (row.sourceType === "faq") return row.body.match(/faq:\d{4}/)?.[0] ?? "";
  return "";
}

export function firstExpectedRank(expected: string[], hits: RagHit[], cutoff = retrievalCutoff) {
  const top = hits.slice(0, cutoff);
  for (let index = 0; index < top.length; index += 1) {
    const key = top[index]?.sourceKey;
    if (key && expected.includes(key)) return index + 1;
  }
  return null;
}

export function hitAt5(rows: Array<{ expected: string[]; hits: RagHit[] }>) {
  const scored = rows.filter((row) => row.expected.length > 0);
  if (scored.length === 0) return 0;
  const hits = scored.filter((row) => firstExpectedRank(row.expected, row.hits) !== null).length;
  return hits / scored.length;
}

export function mrrAt5(rows: Array<{ expected: string[]; hits: RagHit[] }>) {
  const scored = rows.filter((row) => row.expected.length > 0);
  if (scored.length === 0) return 0;
  const total = scored.reduce((sum, row) => {
    const rank = firstExpectedRank(row.expected, row.hits);
    return sum + (rank === null ? 0 : 1 / rank);
  }, 0);
  return total / scored.length;
}

export function meanTop1(rows: Array<{ hits: RagHit[] }>) {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + (row.hits[0]?.similarity ?? 0), 0);
  return total / rows.length;
}

export function extremeRejection(rows: Array<{ expected: string[]; hits: RagHit[] }>) {
  const outliers = rows.filter((row) => row.expected.length === 0);
  if (outliers.length === 0) return 0;
  const rejected = outliers.filter((row) => {
    const top = row.hits[0];
    return !top || top.similarity < extremeRejectionThreshold;
  }).length;
  return rejected / outliers.length;
}

export function noiseDelta(matchingHit: number, noisyHit: number) {
  return matchingHit - noisyHit;
}

export function buildRagQueryFixture(): RagEvalQuery[] {
  const chunks = faqChunks();
  const matching: RagEvalQuery[] = [];
  const noisy: RagEvalQuery[] = [];
  for (let index = 0; index < 30; index += 1) {
    const chunk = chunks[index];
    if (!chunk) continue;
    const pairId = `pair-${String(index + 1).padStart(2, "0")}`;
    const clean = paraphrase(chunk.title);
    matching.push({
      id: `matching-${String(index + 1).padStart(2, "0")}`,
      set: "matching",
      query: clean,
      expected_source_keys: [chunk.sourceKey],
      pair_id: pairId,
    });
    noisy.push({
      id: `noisy-${String(index + 1).padStart(2, "0")}`,
      set: "noisy",
      query: `${misspell(clean)} ${junkToken}`,
      expected_source_keys: [chunk.sourceKey],
      pair_id: pairId,
    });
  }

  const keyed = chunks.slice(0, 15).map((chunk, index) => ({
    id: `extreme-key-${String(index + 1).padStart(2, "0")}`,
    set: "extreme" as const,
    query: topicFromTitle(chunk.title),
    expected_source_keys: [chunk.sourceKey],
  }));

  const outliers = outOfCorpus.map((query, index) => ({
    id: `extreme-out-${String(index + 1).padStart(2, "0")}`,
    set: "extreme" as const,
    query,
    expected_source_keys: [],
  }));

  return [...matching, ...noisy, ...keyed, ...outliers];
}

export type RagEvalGroup = {
  label: string;
  queries: number;
  hitAt5: number | null;
  mrrAt5: number | null;
  meanTop1: number | null;
  rejection: number | null;
};

export function evaluationGroups(
  queries: RagEvalQuery[],
  hitsById: Map<string, RagHit[]>,
): RagEvalGroup[] {
  const rows = queries.map((query) => ({
    set: query.set,
    expected: query.expected_source_keys,
    hits: hitsById.get(query.id) ?? [],
  }));
  const matching = rows.filter((row) => row.set === "matching");
  const noisy = rows.filter((row) => row.set === "noisy");
  const extremeKeyed = rows.filter((row) => row.set === "extreme" && row.expected.length > 0);
  const extremeOut = rows.filter((row) => row.set === "extreme" && row.expected.length === 0);
  return [
    group("Matching", matching, false),
    group("Noisy", noisy, false),
    group("Extreme, with an expected key", extremeKeyed, false),
    group("Extreme, out of corpus", extremeOut, true),
  ];
}

export function renderRagReport(groups: RagEvalGroup[], corpusSize?: number, faqCount?: number) {
  const matching = groups.find((group) => group.label === "Matching");
  const noisy = groups.find((group) => group.label === "Noisy");
  const delta = noiseDelta(matching?.hitAt5 ?? 0, noisy?.hitAt5 ?? 0);
  const lines = [
    "# RAG evaluation",
    "",
    `Retrieval used \`${embeddingModelName}\` at ${embeddingDimensionCount} dimensions with cosine distance. Documents are prefixed with \`search_document:\` and queries with \`search_query:\`. \`match_knowledge\` ran as an authenticated student, so the existing select policy kept draft chunks and unenrolled lesson chunks out of the scored rows. Metrics use the first ${retrievalCutoff} rows.`,
    "",
    "| Set | Queries | Hit@5 | MRR@5 | Mean top-1 cosine |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...groups.map((group) => {
      if (group.rejection !== null) {
        return `| ${group.label} | ${group.queries} | — | — | ${formatFraction(group.meanTop1 ?? 0)} |`;
      }
      return `| ${group.label} | ${group.queries} | ${formatFraction(group.hitAt5 ?? 0)} | ${formatFraction(group.mrrAt5 ?? 0)} | ${formatFraction(group.meanTop1 ?? 0)} |`;
    }),
    "",
    rejectionSentence(groups),
    "",
    `Noise delta (matching Hit@5 minus noisy Hit@5): ${formatFraction(delta)}. A positive delta means the clean set hit more often than the noisy set.`,
    "",
    ...(corpusSize === undefined
      ? []
      : [
          `The scored corpus has ${corpusSize} embedded chunks. The 5,000 FAQ record requirement is ${(faqCount ?? 0) >= 5000 ? "met" : "not met"}.`,
          "",
        ]),
  ];
  return lines.join("\n");
}

function rejectionSentence(groups: RagEvalGroup[]) {
  const outliers = groups.find((group) => group.rejection !== null);
  const rate = formatFraction(outliers?.rejection ?? 0);
  const queries = outliers?.queries ?? 0;
  const mean = formatFraction(outliers?.meanTop1 ?? 0);
  return `Extreme rejection at cosine ${extremeRejectionThreshold}: ${rate}. This is the share of the ${queries} out-of-corpus queries whose top row is missing or whose cosine similarity is below ${extremeRejectionThreshold}. It is not Hit@5 or MRR@5, because those queries have no expected key. Their mean top-1 cosine is ${mean}.`;
}

function group(
  label: string,
  rows: Array<{ expected: string[]; hits: RagHit[] }>,
  outlier: boolean,
): RagEvalGroup {
  return {
    label,
    queries: rows.length,
    hitAt5: outlier ? null : hitAt5(rows),
    mrrAt5: outlier ? null : mrrAt5(rows),
    meanTop1: meanTop1(rows),
    rejection: outlier ? extremeRejection(rows) : null,
  };
}

function paraphrase(title: string) {
  return title
    .replace(/^How does /, "In what way does ")
    .replace(" help ", " support ")
    .replace(" with ", " when they need ");
}

function misspell(query: string) {
  return query.replaceAll("learner", "learnr").replaceAll("means", "meens");
}

function topicFromTitle(title: string) {
  return title.match(/^How does (.+) help /)?.[1] ?? title;
}

function formatFraction(value: number) {
  return value.toFixed(3);
}
