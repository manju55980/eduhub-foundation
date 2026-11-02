import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ollamaHostFromEnv } from "../supabase/functions/_shared/embeddings.ts";
import {
  classifyHeldOut,
  formatAccuracy,
  formatMetric,
  heldOutIsComplete,
  levelAccuracyReportPath,
  levelModelFor,
  levelProviderFromArgs,
  mergeSavedPredictions,
  ollamaEvaluationPassed,
  replaceGeminiReportRequested,
  reportMeetsBar,
  savedLevelPredictionsFromUnknown,
  shouldWriteReport,
  splitLabelledRows,
  type LabelledCourse,
  type SavedLevelPrediction,
} from "../supabase/functions/_shared/level-accuracy.ts";

loadLocalEnv();

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(root, "scripts/fixtures/level-labelled.json");
const progressPath = resolve(root, "scripts/fixtures/level-progress.json");
const providerChoice = levelProviderFromArgs(process.argv.slice(2), process.env);
if (!providerChoice.ok) {
  console.error(providerChoice.message);
  process.exit(1);
}
const provider = providerChoice.provider;
const model = levelModelFor(
  provider,
  provider === "ollama" ? process.env.OLLAMA_LEVEL_MODEL : undefined,
);
const reportPath = resolve(root, levelAccuracyReportPath(provider));

const rows = labelledRowsFromFile(fixturePath);
const testIds = new Set(splitLabelledRows(rows).test.map((row) => row.id));
const stored = savedLevelPredictionsFromUnknown(readProgress(progressPath)).filter(
  (item) => testIds.has(item.id) || item.provider !== provider || item.model !== model,
);
let progress = stored;
writeProgress(progress);
const result = await classifyHeldOut(rows, {
  provider,
  model,
  apiKey: process.env.GEMINI_API_KEY,
  ollamaHost: ollamaHostFromEnv(process.env),
  fetchImpl: fetch,
  saved: progress,
  onCompleted(prediction) {
    progress = mergeSavedPredictions(progress, prediction);
    writeProgress(progress);
  },
});
const { summary } = result;
const accuracyText = summary.accuracy === null ? "not available" : formatAccuracy(summary.accuracy);
console.log(
  `Provider: ${provider}. Model: ${model}. Train count: ${result.split.train.length}. Test count: ${summary.testCount}. Classified: ${summary.classified}. Coverage: ${formatAccuracy(summary.coverage)}. Accuracy: ${accuracyText}. Precision (macro): ${formatMetric(summary.metrics.macro.precision)}. Recall (macro): ${formatMetric(summary.metrics.macro.recall)}. F1 (macro): ${formatMetric(summary.metrics.macro.f1)}. Classification errors: ${summary.classificationErrors}. Infrastructure errors: ${summary.infrastructureErrors}.`,
);

if (provider === "ollama") {
  if (!heldOutIsComplete(summary)) {
    console.error("The held-out set is incomplete. The Ollama report was not written.");
    process.exit(1);
  }
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, result.report);
  console.log(`Wrote ${levelAccuracyReportPath(provider)}`);
  if (!ollamaEvaluationPassed(summary)) {
    console.error("The Ollama precision, recall, and F1 target is not met.");
    process.exit(1);
  }
} else if (!shouldWriteReport(summary)) {
  console.error("The 0.70 target is not met.");
  if (existsSync(reportPath) && reportMeetsBar(readFileSync(reportPath, "utf8"))) {
    console.error("The existing passing report was kept.");
  }
  process.exit(1);
} else if (!replaceGeminiReportRequested(process.argv.slice(2))) {
  console.log(`The Gemini baseline at ${levelAccuracyReportPath(provider)} was kept.`);
} else {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, result.report);
  console.log(`Wrote ${levelAccuracyReportPath(provider)}`);
}

function labelledRowsFromFile(path: string): LabelledCourse[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("The labelled file is not a list.");
  return parsed.map(labelledRow);
}

function labelledRow(value: unknown, index: number): LabelledCourse {
  if (!value || typeof value !== "object") throw new Error(`Row ${index + 1} is not an object.`);
  const id = text(value, "id");
  const title = text(value, "title");
  const description = text(value, "description");
  const level = text(value, "level");
  if (!id || !title || !description) throw new Error(`Row ${index + 1} is missing text.`);
  if (level !== "beginner" && level !== "intermediate" && level !== "advanced") {
    throw new Error(`Row ${index + 1} has an unknown level.`);
  }
  return { id, title, description, level };
}

function text(row: object, key: string) {
  if (!(key in row)) return "";
  const value = row[key as keyof typeof row];
  return typeof value === "string" ? value.trim() : "";
}

function readProgress(path: string): unknown {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function writeProgress(predictions: SavedLevelPrediction[]) {
  mkdirSync(dirname(progressPath), { recursive: true });
  writeFileSync(progressPath, `${JSON.stringify(predictions, null, 2)}\n`);
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
