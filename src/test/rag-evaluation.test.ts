import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildRagQueryFixture,
  evaluationGroups,
  extremeRejection,
  firstExpectedRank,
  hitAt5,
  isAcceptedExpectedKey,
  meanTop1,
  mrrAt5,
  noiseDelta,
  renderRagReport,
  sourceKeyFromMatch,
  type RagEvalQuery,
  type RagHit,
} from "../../supabase/functions/_shared/rag-evaluation.ts";

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/fixtures/rag-queries.json"), "utf8"),
) as RagEvalQuery[];

describe("RAG retrieval metrics", () => {
  it("scores Hit@5 and MRR@5 from the first expected key", () => {
    const rows = [
      { expected: ["faq:0001"], hits: hits(["faq:0009", "faq:0001"]) },
      { expected: ["faq:0002"], hits: hits(["faq:0008"]) },
    ];

    expect(firstExpectedRank(["faq:0001"], rows[0]?.hits ?? [])).toBe(2);
    expect(hitAt5(rows)).toBe(0.5);
    expect(mrrAt5(rows)).toBe(0.25);
    expect(meanTop1([{ hits: [] }, { hits: [{ sourceKey: "faq:0001", similarity: 0.5 }] }])).toBe(
      0.25,
    );
  });

  it("reports the matching-versus-noisy delta and extreme rejection", () => {
    const matching = [{ expected: ["faq:0001"], hits: hits(["faq:0001"]) }];
    const noisy = [{ expected: ["faq:0001"], hits: hits(["faq:0099"]) }];
    expect(noiseDelta(hitAt5(matching), hitAt5(noisy))).toBe(1);

    const outliers = [
      { expected: [], hits: [{ sourceKey: "faq:0001", similarity: 0.8 }] },
      { expected: [], hits: [{ sourceKey: "faq:0001", similarity: 0.75 }] },
      { expected: [], hits: [{ sourceKey: "faq:0001", similarity: 0.74 }] },
      { expected: [], hits: [] },
    ];
    expect(extremeRejection(outliers)).toBe(0.5);
  });

  it("rejects a lesson source key and keeps the stored fixture paired", () => {
    expect(isAcceptedExpectedKey("lesson:11111111-1111-1111-1111-111111111111")).toBe(false);
    expect(isAcceptedExpectedKey("faq:0001")).toBe(true);
    expect(isAcceptedExpectedKey("course:11111111-1111-1111-1111-111111111111")).toBe(true);
    expect(
      sourceKeyFromMatch({
        sourceType: "lesson",
        body: "Halves\nSplit one into two.",
        courseId: "11111111-1111-1111-1111-111111111111",
      }),
    ).toBe("");
    expect(
      sourceKeyFromMatch({
        sourceType: "faq",
        body: "How does note taking help a new learner?\nfaq:0001.",
        courseId: null,
      }),
    ).toBe("faq:0001");

    expect(fixture).toEqual(buildRagQueryFixture());
    const matching = fixture.filter((query) => query.set === "matching");
    const noisy = fixture.filter((query) => query.set === "noisy");
    const extreme = fixture.filter((query) => query.set === "extreme");
    expect(matching).toHaveLength(30);
    expect(noisy).toHaveLength(30);
    expect(extreme).toHaveLength(30);
    expect(extreme.filter((query) => query.expected_source_keys.length === 0)).toHaveLength(15);
    for (const query of [...matching, ...noisy, ...extreme]) {
      expect(query.expected_source_keys.every(isAcceptedExpectedKey)).toBe(true);
    }
    for (const query of noisy) {
      const pair = matching.find((row) => row.pair_id === query.pair_id);
      expect(pair?.expected_source_keys).toEqual(query.expected_source_keys);
      expect(query.query).toContain("zxqvjunk");
      expect(query.query).toContain("learnr");
    }
  });

  it("writes the out-of-corpus row as a rejection rate", () => {
    const queries = buildRagQueryFixture();
    const hitsById = new Map(
      queries.map((query) => [
        query.id,
        query.expected_source_keys.length > 0 ? hits(query.expected_source_keys) : [],
      ]),
    );
    const report = renderRagReport(evaluationGroups(queries, hitsById), 208);
    expect(report).toContain("nomic-embed-text");
    expect(report).toContain("768");
    expect(report).toContain("cosine");
    expect(report).toContain("| Extreme, out of corpus | 15 | — | — | 0.000 |");
    expect(report).toContain(
      "Extreme rejection at cosine 0.75: 1.000. This is the share of the 15 out-of-corpus queries whose top row is missing or whose cosine similarity is below 0.75. It is not Hit@5 or MRR@5, because those queries have no expected key. Their mean top-1 cosine is 0.000.",
    );
    expect(report).toContain("Noise delta (matching Hit@5 minus noisy Hit@5): 0.000.");
    expect(report).toContain(
      "The scored corpus has 208 embedded chunks. The 5,000 FAQ record requirement is not met.",
    );
    expect(report).not.toMatch(/GEMINI_API_KEY|AIza/);
  });
});

function hits(keys: string[]): RagHit[] {
  return keys.map((sourceKey, index) => ({ sourceKey, similarity: 0.9 - index * 0.1 }));
}
