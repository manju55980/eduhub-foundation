import { describe, expect, it } from "vitest";

import {
  answerRelevance,
  contextPrecision,
  faithfulness,
  fuseChunks,
  keywordQuery,
  lexicalAnswer,
  type HybridChunk,
} from "../../supabase/functions/_shared/hybrid-search.ts";

function chunk(id: string, title: string, body = ""): HybridChunk {
  return {
    id,
    sourceType: "faq",
    title,
    body,
    courseId: null,
    similarity: 0.5,
  };
}

describe("hybrid search", () => {
  it("builds an or query from the longer words", () => {
    expect(keywordQuery("What is a Prompt engineering tip?")).toBe(
      "what or prompt or engineering or tip",
    );
  });

  it("ranks a row that is in both lists and shares the query words first", () => {
    const vector = [chunk("a", "Other topic"), chunk("b", "Prompt engineering")];
    const text = [chunk("b", "Prompt engineering"), chunk("c", "Prompt notes")];
    const fused = fuseChunks(vector, text, "prompt engineering");
    expect(fused.map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(fused[0]?.similarity).toBe(0.5);
  });

  it("scores context precision from the expected key", () => {
    expect(contextPrecision(["faq:0001"], ["faq:0002", "faq:0001"])).toBe(0.5);
    expect(contextPrecision([], ["faq:0001"])).toBeNull();
  });

  it("scores an answer copied from the retrieved text", () => {
    const answer = lexicalAnswer("prompt engineering", [
      "Prompt engineering starts with a clear task.",
    ]);
    expect(faithfulness(answer, ["Prompt engineering starts with a clear task."])).toBe(1);
    expect(answerRelevance("prompt engineering", answer)).toBe(1);
  });
});
