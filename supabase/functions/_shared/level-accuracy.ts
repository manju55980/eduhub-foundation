import { embedBackoffMs, embeddingTimeoutMs, withGeminiTimeout } from "./embeddings.ts";
import { completeJsonDetailed, type CompletionFailureKind } from "./gemini.ts";

export const levelAccuracySeed = 42;
export const levelNames = ["beginner", "intermediate", "advanced"] as const;
export const fewShotLimit = 8;
export const accuracyBar = 0.7;
export const levelMaxAttempts = 4;
export const levelRetryBaseDelayMs = 1000;

export type CourseLevel = (typeof levelNames)[number];

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
  };
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

export function levelReport(input: { trainCount: number; score: LevelScore }) {
  const accuracy =
    input.score.accuracy === null ? "not available" : formatAccuracy(input.score.accuracy);
  const header = [
    "# Course level accuracy",
    "",
    "| Field | Value |",
    "| ----- | ----- |",
    "| Model | `gemini-3.5-flash-lite` |",
    `| Seed | ${levelAccuracySeed} |`,
    `| Train count | ${input.trainCount} |`,
    `| Test count | ${input.score.testCount} |`,
    `| Classified | ${input.score.classified} |`,
    `| Coverage | ${formatAccuracy(input.score.coverage)} |`,
    `| Accuracy | ${accuracy} |`,
    `| Classification errors | ${input.score.classificationErrors} |`,
    `| Infrastructure errors | ${input.score.infrastructureErrors} |`,
    `| Not attempted | ${input.score.notAttempted} |`,
    `| Invalid replies | ${input.score.invalid} |`,
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
    apiKey: string | undefined;
    fetchImpl: typeof fetch;
    saved?: SavedLevelPrediction[];
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    onCompleted?: (prediction: SavedLevelPrediction) => void | Promise<void>;
  },
) {
  const split = splitLabelledRows(rows);
  const examples = fewShotExamples(split.train);
  const saved = options.saved ?? [];
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
    const completed = { id: row.id, predicted: attempt.predicted };
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
    report: levelReport({ trainCount: split.train.length, score: summary }),
  };
}

async function classifyRow(
  row: LabelledCourse,
  examples: LabelledCourse[],
  options: {
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
    const completion = await completeJsonDetailed(
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
      return { outcome: "infrastructure", kind: completion.kind, predicted: null };
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
