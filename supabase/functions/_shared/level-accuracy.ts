import {
  defaultOllamaHost,
  embedBackoffMs,
  embeddingTimeoutMs,
  withGeminiTimeout,
} from "./embeddings.ts";
import { completeJsonDetailed, geminiModel, type CompletionFailureKind } from "./gemini.ts";
import { completeOllamaJson, defaultOllamaLevelModel } from "./ollama-chat.ts";

export const levelAccuracySeed = 42;
export const levelNames = ["beginner", "intermediate", "advanced"] as const;
export const levelProviders = ["gemini", "ollama"] as const;
export const fewShotLimit = 8;
export const accuracyBar = 0.7;
export const f1Bar = 0.85;
export const levelMaxAttempts = 4;
export const levelRetryBaseDelayMs = 1000;
export const geminiLevelReportPath = "docs/assessment-2/level-accuracy.md";
export const ollamaLevelReportPath = "docs/assessment-2/level-accuracy-ollama.md";

export type CourseLevel = (typeof levelNames)[number];
export type LevelProvider = (typeof levelProviders)[number];

export type LabelledCourse = {
  id: string;
  title: string;
  description: string;
  level: CourseLevel;
};

export type LevelOutcome = "classified" | "invalid" | "infrastructure";

export type LevelPrediction = {
  id: string;
  actual: CourseLevel;
  predicted: CourseLevel | null;
  outcome: LevelOutcome;
};

export type SavedLevelPrediction = {
  id: string;
  predicted: CourseLevel | null;
  provider: LevelProvider;
  model: string;
};

export type ClassMetric = {
  precision: number;
  recall: number;
  f1: number;
  support: number;
};

export type LevelMetrics = {
  perClass: Record<CourseLevel, ClassMetric>;
  macro: { precision: number; recall: number; f1: number };
};

export type LevelScore = {
  matrix: ConfusionMatrix;
  correct: number;
  invalid: number;
  classified: number;
  classificationErrors: number;
  infrastructureErrors: number;
  notAttempted: number;
  testCount: number;
  coverage: number;
  accuracy: number | null;
  metrics: LevelMetrics;
};

export type ConfusionMatrix = Record<CourseLevel, Record<CourseLevel, number>>;

const topics = [
  "photosynthesis",
  "fractions",
  "map reading",
  "sentence structure",
  "simple circuits",
  "plant care",
  "counting money",
  "local history",
  "water safety",
  "drawing shapes",
  "kitchen measures",
  "animal habitats",
  "calendar time",
  "basic maps",
  "sound and pitch",
  "recycling",
  "story sequence",
  "weather charts",
  "hand tools",
  "number patterns",
  "library search",
  "team sports rules",
  "color mixing",
  "food groups",
  "neighborhood maps",
  "simple machines",
  "public speaking",
  "note taking",
  "data tables",
  "first aid basics",
  "music rhythm",
  "garden soil",
  "computer files",
  "geometry names",
];

export function labelledLevelRows(): LabelledCourse[] {
  return Array.from({ length: 200 }, (_, index) => {
    const sequence = index + 1;
    const level = levelNames[index % levelNames.length] ?? "beginner";
    const topic = topics[index % topics.length] ?? "study skills";
    return labelledRow(sequence, level, topic);
  });
}

export function splitLabelledRows(rows: LabelledCourse[], seed = levelAccuracySeed) {
  const shuffled = shuffleWithSeed(rows, seed);
  const testCount = Math.floor(rows.length * 0.2);
  return {
    train: shuffled.slice(0, shuffled.length - testCount),
    test: shuffled.slice(shuffled.length - testCount),
  };
}

export function fewShotExamples(train: LabelledCourse[], limit = fewShotLimit) {
  const chosen: LabelledCourse[] = [];
  const used = new Set<string>();
  for (const level of levelNames) {
    const example = train.find((row) => row.level === level);
    if (!example || used.has(example.id)) continue;
    chosen.push(example);
    used.add(example.id);
  }
  for (const row of train) {
    if (chosen.length >= limit) break;
    if (used.has(row.id)) continue;
    chosen.push(row);
    used.add(row.id);
  }
  return chosen.slice(0, limit);
}

export function levelPrompt(test: LabelledCourse, examples: LabelledCourse[]) {
  const shots = examples
    .map((row) => `Title: ${row.title}\nDescription: ${row.description}\nLevel: ${row.level}`)
    .join("\n\n");
  return {
    system:
      'Classify one course as beginner, intermediate, or advanced. Reply with JSON only: {"level":"beginner"|"intermediate"|"advanced"}.',
    user: `Examples:\n${shots}\n\nCourse to classify:\nTitle: ${test.title}\nDescription: ${test.description}`,
  };
}

export function parseLevelPrediction(value: unknown): CourseLevel | null {
  if (!value || typeof value !== "object" || !("level" in value)) return null;
  return isCourseLevel(value.level) ? value.level : null;
}

export function scorePredictions(
  predictions: LevelPrediction[],
  testCount = predictions.length,
): LevelScore {
  const matrix = emptyMatrix();
  const invalidByLevel = emptyLevelCounts();
  let correct = 0;
  let invalid = 0;
  let infrastructureErrors = 0;
  for (const prediction of predictions) {
    if (prediction.outcome === "infrastructure") {
      infrastructureErrors += 1;
      continue;
    }
    if (prediction.outcome === "invalid" || !prediction.predicted) {
      invalid += 1;
      invalidByLevel[prediction.actual] += 1;
      continue;
    }
    matrix[prediction.actual][prediction.predicted] += 1;
    if (prediction.predicted === prediction.actual) correct += 1;
  }
  const classified = predictions.length - infrastructureErrors;
  const classificationErrors = classified - correct;
  return {
    matrix,
    correct,
    invalid,
    classified,
    classificationErrors,
    infrastructureErrors,
    notAttempted: Math.max(0, testCount - predictions.length),
    testCount,
    coverage: testCount === 0 ? 0 : classified / testCount,
    accuracy: classified === 0 ? null : correct / classified,
    metrics: levelClassMetrics(matrix, invalidByLevel),
  };
}

export function levelClassMetrics(
  matrix: ConfusionMatrix,
  invalidByLevel: Record<CourseLevel, number> = emptyLevelCounts(),
): LevelMetrics {
  const perClass = emptyClassMetrics();
  for (const level of levelNames) {
    const truePositive = matrix[level][level];
    const falsePositive = levelNames.reduce(
      (sum, actual) => (actual === level ? sum : sum + matrix[actual][level]),
      0,
    );
    const falseNegative =
      levelNames.reduce(
        (sum, predicted) => (predicted === level ? sum : sum + matrix[level][predicted]),
        0,
      ) + invalidByLevel[level];
    const precision = ratio(truePositive, truePositive + falsePositive);
    const recall = ratio(truePositive, truePositive + falseNegative);
    perClass[level] = {
      precision,
      recall,
      f1: harmonicMean(precision, recall),
      support: truePositive + falseNegative,
    };
  }
  return {
    perClass,
    macro: {
      precision: mean(levelNames.map((level) => perClass[level].precision)),
      recall: mean(levelNames.map((level) => perClass[level].recall)),
      f1: mean(levelNames.map((level) => perClass[level].f1)),
    },
  };
}

export function meetsF1Bar(f1: number | null) {
  return f1 !== null && f1 >= f1Bar;
}

export function heldOutIsComplete(score: Pick<LevelScore, "classified" | "testCount">) {
  return score.testCount > 0 && score.classified === score.testCount;
}

export function ollamaEvaluationPassed(score: LevelScore) {
  return (
    heldOutIsComplete(score) &&
    meetsAccuracyBar(score.accuracy) &&
    meetsF1Bar(score.metrics.macro.f1)
  );
}

export function meetsAccuracyBar(accuracy: number | null) {
  return accuracy !== null && accuracy >= accuracyBar;
}

export function formatAccuracy(accuracy: number) {
  return `${accuracy.toFixed(3)} (${(accuracy * 100).toFixed(1)}%)`;
}

export function readReportedAccuracy(markdown: string) {
  const match = markdown.match(/\| Accuracy \| ([0-9]+(?:\.[0-9]+)?) \(/);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function readReportedCount(markdown: string, label: string) {
  const match = markdown.match(new RegExp(`\\| ${label} \\| (\\d+) \\|`));
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

export function shouldWriteReport(
  score: Pick<LevelScore, "accuracy" | "classified" | "testCount">,
) {
  return (
    meetsAccuracyBar(score.accuracy) && score.testCount > 0 && score.classified === score.testCount
  );
}

export function reportMeetsBar(markdown: string) {
  const classified = readReportedCount(markdown, "Classified");
  const testCount = readReportedCount(markdown, "Test count");
  if (classified === null || testCount === null) return false;
  return shouldWriteReport({
    accuracy: readReportedAccuracy(markdown),
    classified,
    testCount,
  });
}

export function levelReport(input: {
  trainCount: number;
  score: LevelScore;
  provider?: LevelProvider;
  model?: string;
}) {
  const provider = input.provider ?? "gemini";
  const model = input.model?.trim() || levelModelFor(provider);
  const accuracy =
    input.score.accuracy === null ? "not available" : formatAccuracy(input.score.accuracy);
  const intro =
    provider === "ollama"
      ? [
          "# Course level accuracy (Ollama)",
          "",
          `This report is the local Ollama held-out classification. The Gemini baseline stays in \`${geminiLevelReportPath}\`.`,
          "",
        ]
      : ["# Course level accuracy", ""];
  const header = [
    ...intro,
    "| Field | Value |",
    "| ----- | ----- |",
    `| Provider | \`${provider}\` |`,
    `| Model | \`${model}\` |`,
    `| Seed | ${levelAccuracySeed} |`,
    `| Train count | ${input.trainCount} |`,
    `| Test count | ${input.score.testCount} |`,
    `| Classified | ${input.score.classified} |`,
    `| Coverage | ${formatAccuracy(input.score.coverage)} |`,
    `| Accuracy | ${accuracy} |`,
    `| Precision (macro) | ${formatMetric(input.score.metrics.macro.precision)} |`,
    `| Recall (macro) | ${formatMetric(input.score.metrics.macro.recall)} |`,
    `| F1 (macro) | ${formatMetric(input.score.metrics.macro.f1)} |`,
    `| Classification errors | ${input.score.classificationErrors} |`,
    `| Infrastructure errors | ${input.score.infrastructureErrors} |`,
    `| Not attempted | ${input.score.notAttempted} |`,
    `| Invalid replies | ${input.score.invalid} |`,
    "",
    "## Per-class metrics",
    "",
    "Precision, recall, and F1 use successfully classified held-out rows. An invalid reply counts against recall for its actual level. Infrastructure failures and rows that were not attempted stay outside these metrics. Macro scores are the unweighted mean of the three levels.",
    "",
    "| Level | Support | Precision | Recall | F1 |",
    "| ----- | ------: | --------: | -----: | -: |",
    ...levelNames.map((level) => {
      const metric = input.score.metrics.perClass[level];
      return `| ${level} | ${metric.support} | ${formatMetric(metric.precision)} | ${formatMetric(metric.recall)} | ${formatMetric(metric.f1)} |`;
    }),
    "",
    "## Confusion matrix",
    "",
    "Rows are the actual level. Columns are the predicted level. Accuracy uses only successfully classified held-out rows.",
    "",
    "| Actual \\ Predicted | beginner | intermediate | advanced |",
    "| ------------------- | -------- | ------------ | -------- |",
    ...levelNames.map(
      (level) =>
        `| ${level} | ${input.score.matrix[level].beginner} | ${input.score.matrix[level].intermediate} | ${input.score.matrix[level].advanced} |`,
    ),
    "",
  ];
  return `${header.join("\n")}\n`;
}

export function levelAccuracyReportPath(provider: LevelProvider) {
  return provider === "ollama" ? ollamaLevelReportPath : geminiLevelReportPath;
}

export function levelModelFor(provider: LevelProvider, model?: string) {
  const chosen = model?.trim() ?? "";
  if (chosen) return chosen;
  return provider === "ollama" ? defaultOllamaLevelModel : geminiModel;
}

export function levelProviderFromArgs(argv: string[], env: Record<string, string | undefined>) {
  const flagIndex = argv.indexOf("--provider");
  const fromFlag = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
  if (flagIndex >= 0 && (fromFlag === undefined || fromFlag.startsWith("--"))) {
    return { ok: false as const, message: "Provider must be gemini or ollama." };
  }
  const raw = (fromFlag ?? env["LEVEL_PROVIDER"])?.trim();
  if (!raw) return { ok: true as const, provider: "gemini" as const };
  if (raw === "gemini" || raw === "ollama") return { ok: true as const, provider: raw };
  return { ok: false as const, message: "Provider must be gemini or ollama." };
}

export function replaceGeminiReportRequested(argv: string[]) {
  return argv.includes("--replace-gemini-report");
}

export function normalizeSavedPrediction(value: unknown): SavedLevelPrediction | null {
  if (!value || typeof value !== "object" || !("id" in value) || !("predicted" in value)) {
    return null;
  }
  const id = value.id;
  const predicted = value.predicted;
  if (typeof id !== "string" || !id) return null;
  if (
    predicted !== null &&
    predicted !== "beginner" &&
    predicted !== "intermediate" &&
    predicted !== "advanced"
  ) {
    return null;
  }
  const providerValue = "provider" in value ? value.provider : undefined;
  const provider = providerValue === undefined ? "gemini" : providerValue;
  if (provider !== "gemini" && provider !== "ollama") return null;
  const modelValue = "model" in value && typeof value.model === "string" ? value.model.trim() : "";
  return { id, predicted, provider, model: modelValue || levelModelFor(provider) };
}

export function savedLevelPredictionsFromUnknown(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const saved = normalizeSavedPrediction(item);
    return saved ? [saved] : [];
  });
}

export function predictionsForModel(
  saved: readonly SavedLevelPrediction[],
  provider: LevelProvider,
  model: string,
) {
  return saved.filter((item) => item.provider === provider && item.model === model);
}

export function mergeSavedPredictions(
  existing: readonly SavedLevelPrediction[],
  completed: SavedLevelPrediction,
) {
  const index = existing.findIndex(
    (item) =>
      item.id === completed.id &&
      item.provider === completed.provider &&
      item.model === completed.model,
  );
  if (index < 0) return [...existing, completed];
  const next = [...existing];
  next[index] = completed;
  return next;
}

function labelledRow(sequence: number, level: CourseLevel, topic: string): LabelledCourse {
  const id = `label-${String(sequence).padStart(4, "0")}`;
  if (level === "beginner") {
    return {
      id,
      title: `Beginner introduction to ${topic}`,
      description: `This first-steps course assumes no prior knowledge. Learners start with the basic terms of ${topic}.`,
      level,
    };
  }
  if (level === "intermediate") {
    return {
      id,
      title: `Intermediate practice in ${topic}`,
      description: `This course builds on a first course. Learners practice ${topic} and already have some experience.`,
      level,
    };
  }
  return {
    id,
    title: `Advanced specialist study of ${topic}`,
    description: `This expert course is for learners who already work with ${topic}. It covers specialist problems.`,
    level,
  };
}

function shuffleWithSeed<T>(items: T[], seed: number) {
  const copy = [...items];
  const random = mulberry32(seed);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index];
    const next = copy[swap];
    if (current === undefined || next === undefined) continue;
    copy[index] = next;
    copy[swap] = current;
  }
  return copy;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyMatrix(): ConfusionMatrix {
  return {
    beginner: { beginner: 0, intermediate: 0, advanced: 0 },
    intermediate: { beginner: 0, intermediate: 0, advanced: 0 },
    advanced: { beginner: 0, intermediate: 0, advanced: 0 },
  };
}

function emptyLevelCounts(): Record<CourseLevel, number> {
  return { beginner: 0, intermediate: 0, advanced: 0 };
}

function emptyClassMetrics(): Record<CourseLevel, ClassMetric> {
  return {
    beginner: { precision: 0, recall: 0, f1: 0, support: 0 },
    intermediate: { precision: 0, recall: 0, f1: 0, support: 0 },
    advanced: { precision: 0, recall: 0, f1: 0, support: 0 },
  };
}

function ratio(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function harmonicMean(precision: number, recall: number) {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatMetric(value: number) {
  return value.toFixed(3);
}

function isCourseLevel(value: unknown): value is CourseLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

export function savedPredictionFor(row: LabelledCourse, saved: SavedLevelPrediction[]) {
  const match = saved.find((item) => item.id === row.id);
  if (!match) return null;
  if (match.predicted !== null && !isCourseLevel(match.predicted)) return null;
  return match;
}

export async function classifyHeldOut(
  rows: LabelledCourse[],
  options: {
    apiKey?: string | undefined;
    provider?: LevelProvider;
    model?: string;
    ollamaHost?: string;
    fetchImpl: typeof fetch;
    saved?: readonly unknown[];
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    onCompleted?: (prediction: SavedLevelPrediction) => void | Promise<void>;
  },
) {
  const provider = options.provider ?? "gemini";
  const model = levelModelFor(provider, options.model);
  const split = splitLabelledRows(rows);
  const examples = fewShotExamples(split.train);
  const saved = predictionsForModel(
    savedLevelPredictionsFromUnknown(options.saved ?? []),
    provider,
    model,
  );
  const maxAttempts = options.maxAttempts ?? levelMaxAttempts;
  const baseDelayMs = options.baseDelayMs ?? levelRetryBaseDelayMs;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const predictions: LevelPrediction[] = [];

  for (const row of split.test) {
    const resumed = savedPredictionFor(row, saved);
    if (resumed) {
      predictions.push(predictionFromSaved(row, resumed));
      continue;
    }
    const attempt = await classifyRow(row, examples, {
      provider,
      model,
      ollamaHost: options.ollamaHost,
      apiKey: options.apiKey,
      fetchImpl: options.fetchImpl,
      maxAttempts,
      baseDelayMs,
      sleep,
    });
    if (attempt.outcome === "infrastructure") {
      predictions.push({
        id: row.id,
        actual: row.level,
        predicted: null,
        outcome: "infrastructure",
      });
      if (attempt.kind === "quota" || attempt.kind === "fatal") break;
      continue;
    }
    const completed = { id: row.id, predicted: attempt.predicted, provider, model };
    predictions.push({
      id: row.id,
      actual: row.level,
      predicted: attempt.predicted,
      outcome: attempt.outcome,
    });
    await options.onCompleted?.(completed);
  }

  const summary = scorePredictions(predictions, split.test.length);
  return {
    split,
    examples,
    predictions,
    summary,
    report: levelReport({ trainCount: split.train.length, score: summary, provider, model }),
  };
}

async function classifyRow(
  row: LabelledCourse,
  examples: LabelledCourse[],
  options: {
    provider: LevelProvider;
    model: string;
    ollamaHost: string | undefined;
    apiKey: string | undefined;
    fetchImpl: typeof fetch;
    maxAttempts: number;
    baseDelayMs: number;
    sleep: (ms: number) => Promise<void>;
  },
): Promise<
  | { outcome: "classified" | "invalid"; predicted: CourseLevel | null }
  | { outcome: "infrastructure"; kind: CompletionFailureKind; predicted: null }
> {
  const prompt = levelPrompt(row, examples);
  const attempts = Math.max(1, options.maxAttempts);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const completion =
      options.provider === "ollama"
        ? await completeOllamaJson(
            {
              host: options.ollamaHost?.trim() || defaultOllamaHost,
              model: options.model,
              system: prompt.system,
              user: prompt.user,
              temperature: 0,
            },
            options.fetchImpl,
          )
        : await completeJsonDetailed(
            { apiKey: options.apiKey, system: prompt.system, user: prompt.user, temperature: 0 },
            withGeminiTimeout(options.fetchImpl, embeddingTimeoutMs),
          );
    if (completion.ok) {
      const predicted = parseLevelPrediction(completion.value);
      return predicted === null
        ? { outcome: "invalid", predicted: null }
        : { outcome: "classified", predicted };
    }
    if (completion.failure === "invalid") return { outcome: "invalid", predicted: null };
    const exhausted = attempt + 1 >= attempts;
    if (!completion.retryable || exhausted) {
      const stopForDownModel =
        options.provider === "ollama" && exhausted && completion.kind === "network";
      return {
        outcome: "infrastructure",
        kind: stopForDownModel ? "fatal" : completion.kind,
        predicted: null,
      };
    }
    await options.sleep(embedBackoffMs(attempt, options.baseDelayMs, completion.retryAfterMs));
  }
  return { outcome: "infrastructure", kind: "fatal", predicted: null };
}

function predictionFromSaved(row: LabelledCourse, saved: SavedLevelPrediction): LevelPrediction {
  if (saved.predicted === null) {
    return { id: row.id, actual: row.level, predicted: null, outcome: "invalid" };
  }
  return { id: row.id, actual: row.level, predicted: saved.predicted, outcome: "classified" };
}
