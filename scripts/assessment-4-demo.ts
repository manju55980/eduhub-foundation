import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateReports } from "../supabase/functions/_shared/eval-gate.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tracePath = resolve(root, "docs/assessment-4/tutor-trace.md");
const hybridPath = resolve(root, "docs/assessment-4/hybrid-rag.md");
const levelPath = resolve(root, "docs/assessment-3/level-accuracy-comparison.md");

const trace = readFileSync(tracePath, "utf8");
const missing = ["## Question", "## Plan", "## Retrieved context", "## Feedback"].filter(
  (heading) => !trace.includes(heading),
);
const scores = evaluateReports(readFileSync(hybridPath, "utf8"), readFileSync(levelPath, "utf8"));
if (missing.length > 0 || !scores.ok) {
  for (const heading of missing) console.error(`The tutor trace is missing ${heading}.`);
  for (const failure of scores.failures) console.error(failure);
  process.exit(1);
}

console.log("Assessment 4 demo evidence is in place.");
console.log("Script: docs/assessment-4/demo.md");
console.log("Live app: https://eduhub-foundation.vercel.app/");
console.log("Course: Advanced Developer Documentation and Process Mastery");
console.log(
  `Faithfulness ${scores.vectorFaithfulness} / ${scores.hybridFaithfulness}. Macro F1 ${scores.geminiF1} / ${scores.ollamaF1}.`,
);
