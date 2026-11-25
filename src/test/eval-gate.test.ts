import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { evaluateReports } from "../../supabase/functions/_shared/eval-gate.ts";

const root = resolve(process.cwd());
const hybrid = readFileSync(resolve(root, "docs/assessment-4/hybrid-rag.md"), "utf8");
const levels = readFileSync(
  resolve(root, "docs/assessment-3/level-accuracy-comparison.md"),
  "utf8",
);

describe("eval gate", () => {
  it("passes the saved reports", () => {
    const result = evaluateReports(hybrid, levels);
    expect(result.ok).toBe(true);
    expect(result.vectorFaithfulness).toBe(1);
    expect(result.hybridFaithfulness).toBe(1);
    expect(result.geminiF1).toBe(1);
    expect(result.ollamaF1).toBe(1);
  });

  it("blocks a report below either cutoff", () => {
    const lowFaith = [
      "| Set | Queries | Vector Hit@5 | Hybrid Hit@5 | Vector MRR@5 | Hybrid MRR@5 | Vector precision | Hybrid precision | Vector faithfulness | Hybrid faithfulness | Vector relevance | Hybrid relevance |",
      "| All | 90 | 0.773 | 0.520 | 0.512 | 0.239 | 0.512 | 0.239 | 0.999 | 1.000 | 0.478 | 0.448 |",
    ].join("\n");
    const lowF1 = "| F1 (macro) | 0.799 | 1.000 |";
    expect(evaluateReports(lowFaith, levels).ok).toBe(false);
    expect(evaluateReports(hybrid, lowF1).failures.join(" ")).toContain("Gemini macro F1");
    expect(evaluateReports("no table", levels).ok).toBe(false);
  });
});
