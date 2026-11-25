import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateReports } from "../supabase/functions/_shared/eval-gate.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hybrid = readFileSync(resolve(root, "docs/assessment-4/hybrid-rag.md"), "utf8");
const levels = readFileSync(
  resolve(root, "docs/assessment-3/level-accuracy-comparison.md"),
  "utf8",
);
const result = evaluateReports(hybrid, levels);

console.log(
  `Faithfulness ${result.vectorFaithfulness ?? "missing"} / ${result.hybridFaithfulness ?? "missing"}. Macro F1 ${result.geminiF1 ?? "missing"} / ${result.ollamaF1 ?? "missing"}.`,
);
if (!result.ok) {
  for (const failure of result.failures) console.error(failure);
  process.exit(1);
}
console.log("Eval gate passed.");
