import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyHeldOut,
  formatAccuracy,
  reportMeetsBar,
  shouldWriteReport,
  splitLabelledRows,
  type LabelledCourse,
  type SavedLevelPrediction,
} from "../supabase/functions/_shared/level-accuracy.ts";

loadLocalEnv();

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(root, "scripts/fixtures/level-labelled.json");
const progressPath = resolve(root, "scripts/fixtures/level-progress.json");
const reportPath = resolve(root, "docs/assessment-2/level-accuracy.md");

const rows = labelledRowsFromFile(fixturePath);
const testIds = new Set(splitLabelledRows(rows).test.map((row) => row.id));
const collected = readProgress(progressPath).filter((item) => testIds.has(item.id));
writeProgress(collected);
const result = await classifyHeldOut(rows, {
  apiKey: process.env.GEMINI_API_KEY,
  fetchImpl: fetch,
  saved: collected,
  onCompleted(prediction) {
    const index = collected.findIndex((item) => item.id === prediction.id);
    if (index >= 0) collected[index] = prediction;
    else collected.push(prediction);
    writeProgress(collected);
  },
});
const { summary } = result;
const accuracyText = summary.accuracy === null ? "not available" : formatAccuracy(summary.accuracy);
console.log(
  `Train count: ${result.split.train.length}. Test count: ${summary.testCount}. Classified: ${summary.classified}. Coverage: ${formatAccuracy(summary.coverage)}. Accuracy: ${accuracyText}. Classification errors: ${summary.classificationErrors}. Infrastructure errors: ${summary.infrastructureErrors}.`,
);

if (!shouldWriteReport(summary)) {
  console.error("The 0.70 target is not met.");
  if (existsSync(reportPath) && reportMeetsBar(readFileSync(reportPath, "utf8"))) {
    console.error("The existing passing report was kept.");
  }
  process.exit(1);
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, result.report);
console.log("Wrote docs/assessment-2/level-accuracy.md");

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

function readProgress(path: string): SavedLevelPrediction[] {
  if (!existsSync(path)) return [];
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isSavedPrediction);
}

function writeProgress(predictions: SavedLevelPrediction[]) {
  mkdirSync(dirname(progressPath), { recursive: true });
  writeFileSync(progressPath, `${JSON.stringify(predictions, null, 2)}\n`);
}

function isSavedPrediction(value: unknown): value is SavedLevelPrediction {
  if (!value || typeof value !== "object" || !("id" in value) || !("predicted" in value))
    return false;
  const id = value.id;
  const predicted = value.predicted;
  if (typeof id !== "string" || !id) return false;
  return (
    predicted === null ||
    predicted === "beginner" ||
    predicted === "intermediate" ||
    predicted === "advanced"
  );
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
