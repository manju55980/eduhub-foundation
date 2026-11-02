import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  classifyHeldOut,
  fewShotExamples,
  fewShotLimit,
  formatAccuracy,
  formatMetric,
  heldOutIsComplete,
  labelledLevelRows,
  levelAccuracyReportPath,
  levelClassMetrics,
  levelNames,
  levelPrompt,
  levelProviderFromArgs,
  levelReport,
  mergeSavedPredictions,
  meetsAccuracyBar,
  normalizeSavedPrediction,
  ollamaEvaluationPassed,
  predictionsForModel,
  readReportedAccuracy,
  replaceGeminiReportRequested,
  reportMeetsBar,
  scorePredictions,
  shouldWriteReport,
  splitLabelledRows,
  type CourseLevel,
  type LabelledCourse,
  type LevelOutcome,
  type LevelScore,
} from "../../supabase/functions/_shared/level-accuracy.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("course level split", () => {
  const rows = labelledLevelRows();

  it("keeps a labelled file of 200 rows and splits the last 20 percent with seed 42", () => {
    const fixture = JSON.parse(
      readFileSync(resolve(root, "scripts/fixtures/level-labelled.json"), "utf8"),
    ) as LabelledCourse[];
    expect(fixture).toEqual(rows);
    expect(rows).toHaveLength(200);
    expect(new Set(rows.map((row) => row.level))).toEqual(new Set(levelNames));
    expect(rows.every((row) => row.id && row.title && row.description && row.level)).toBe(true);

    const first = splitLabelledRows(rows, 42);
    const second = splitLabelledRows(rows, 42);
    expect(first.test).toHaveLength(Math.floor(rows.length * 0.2));
    expect(first.train).toHaveLength(rows.length - first.test.length);
    expect(first.test.map((row) => row.id)).toEqual(second.test.map((row) => row.id));
    const trainIds = new Set(first.train.map((row) => row.id));
    expect(first.test.some((row) => trainIds.has(row.id))).toBe(false);
    expect(trainIds.size + first.test.length).toBe(rows.length);
  });

  it("builds few-shot examples from the train split only", () => {
    const split = splitLabelledRows(rows, 42);
    const examples = fewShotExamples(split.train);
    const testIds = new Set(split.test.map((row) => row.id));

    expect(examples.length).toBeLessThanOrEqual(fewShotLimit);
    expect(examples.map((row) => row.level)).toEqual(expect.arrayContaining([...levelNames]));
    expect(examples.some((row) => testIds.has(row.id))).toBe(false);
    const prompt = levelPrompt(split.test[0]!, examples);
    expect(prompt.user).not.toContain(`Title: ${split.test[1]?.title}`);
    expect(prompt.user.endsWith(split.test[0]!.description)).toBe(true);
    expect(prompt.user).not.toMatch(
      new RegExp(`Course to classify:[\\s\\S]*\\nLevel: ${split.test[0]!.level}`),
    );
  });
});

describe("course level score", () => {
  it("counts an invalid reply as wrong and leaves infrastructure out of accuracy", () => {
    const summary = scorePredictions(
      [
        prediction("1", "beginner", "beginner"),
        prediction("2", "intermediate", "advanced"),
        prediction("3", "advanced", null, "invalid"),
        prediction("4", "beginner", "beginner"),
        prediction("5", "advanced", null, "infrastructure"),
      ],
      6,
    );

    expect(summary.correct).toBe(2);
    expect(summary.invalid).toBe(1);
    expect(summary.classified).toBe(4);
    expect(summary.classificationErrors).toBe(2);
    expect(summary.infrastructureErrors).toBe(1);
    expect(summary.notAttempted).toBe(1);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.coverage).toBeCloseTo(4 / 6);
    expect(summary.matrix.beginner.beginner).toBe(2);
    expect(summary.matrix.intermediate.advanced).toBe(1);
    expect(diagonal(summary.matrix)).toBe(summary.correct);
    expect(meetsAccuracyBar(0.7)).toBe(true);
    expect(meetsAccuracyBar(0.699)).toBe(false);
    expect(meetsAccuracyBar(null)).toBe(false);
    expect(shouldWriteReport({ accuracy: 0.65, classified: 40, testCount: 40 })).toBe(false);
    expect(shouldWriteReport({ accuracy: 1, classified: 16, testCount: 40 })).toBe(false);
    expect(shouldWriteReport({ accuracy: null, classified: 0, testCount: 40 })).toBe(false);
    expect(shouldWriteReport({ accuracy: 0.75, classified: 40, testCount: 40 })).toBe(true);
    expect(formatAccuracy(0.7)).toBe("0.700 (70.0%)");
  });

  it("writes the held-out report without course text", () => {
    const matrix: LevelScore["matrix"] = {
      beginner: { beginner: 12, intermediate: 1, advanced: 0 },
      intermediate: { beginner: 2, intermediate: 10, advanced: 1 },
      advanced: { beginner: 0, intermediate: 6, advanced: 8 },
    };
    const score: LevelScore = {
      matrix,
      metrics: levelClassMetrics(matrix),
      correct: 30,
      invalid: 0,
      classified: 40,
      classificationErrors: 10,
      infrastructureErrors: 0,
      notAttempted: 0,
      testCount: 40,
      coverage: 1,
      accuracy: 0.75,
    };
    const report = levelReport({ trainCount: 160, score });

    expect(report).toContain("`gemini-3.5-flash-lite`");
    expect(report).toContain("| Seed | 42 |");
    expect(report).toContain("| Train count | 160 |");
    expect(report).toContain("| Test count | 40 |");
    expect(report).toContain("| Classified | 40 |");
    expect(report).toContain("| Coverage | 1.000 (100.0%) |");
    expect(report).toContain("| Accuracy | 0.750 (75.0%) |");
    expect(report).toContain("| Classification errors | 10 |");
    expect(report).toContain("| Infrastructure errors | 0 |");
    expect(report).toContain("| beginner | 12 | 1 | 0 |");
    expect(readReportedAccuracy(report)).toBe(0.75);
    expect(reportMeetsBar(report)).toBe(true);
    expect(report).not.toContain("photosynthesis");
    expect(report).not.toContain("GEMINI_API_KEY");
  });

  it("asks Gemini for a level at temperature 0 and scores the mocked replies", async () => {
    const rows = labelledLevelRows().slice(0, 10);
    let temperature = -1;
    const result = await classifyHeldOut(rows, {
      apiKey: "test-key",
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          generationConfig: { temperature: number };
          contents: Array<{ parts: Array<{ text: string }> }>;
        };
        temperature = body.generationConfig.temperature;
        const text = body.contents[0]?.parts[0]?.text ?? "";
        const course = text.split("Course to classify:").at(-1) ?? "";
        const predicted = course.includes("Beginner introduction")
          ? "beginner"
          : course.includes("Intermediate practice")
            ? "intermediate"
            : "advanced";
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ level: predicted }) }] } }],
          }),
          { status: 200 },
        );
      },
      sleep: async () => {},
    });

    expect(temperature).toBe(0);
    expect(result.split.test.length).toBe(Math.floor(rows.length * 0.2));
    expect(result.summary.accuracy).toBe(1);
    expect(result.summary.classified).toBe(result.split.test.length);
    expect(result.summary.infrastructureErrors).toBe(0);
    expect(diagonal(result.summary.matrix)).toBe(result.summary.correct);
    expect(result.report).toContain(formatAccuracy(1));
    expect(shouldWriteReport(result.summary)).toBe(true);
  });

  it("retries a rate limit, stops on quota, and does not repeat a saved prediction", async () => {
    const rows = labelledLevelRows().slice(0, 10);
    const split = splitLabelledRows(rows, 42);
    const saved = { id: split.test[0]!.id, predicted: split.test[0]!.level };
    const calls: string[] = [];
    const sleeps: number[] = [];
    let quotaCalls = 0;

    const resumed = await classifyHeldOut(rows, {
      apiKey: "test-key",
      saved: [saved, { id: "not-in-this-split", predicted: "beginner" }],
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetchImpl: async (_input, init) => {
        const text = requestText(init);
        calls.push(courseSection(text));
        if (calls.length === 1) {
          return new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), {
            status: 429,
            headers: { "retry-after": "1" },
          });
        }
        return levelResponse(text);
      },
    });

    expect(calls).toHaveLength(2);
    expect(calls.every((course) => course.includes(split.test[1]!.title))).toBe(true);
    expect(calls.some((course) => course.includes(split.test[0]!.title))).toBe(false);
    expect(sleeps).toEqual([1000]);
    expect(resumed.summary.accuracy).toBe(1);
    expect(resumed.summary.infrastructureErrors).toBe(0);
    expect(resumed.predictions.some((row) => row.id === "not-in-this-split")).toBe(false);

    const quotaRows = labelledLevelRows().slice(0, 15);
    const quotaSplit = splitLabelledRows(quotaRows, 42);
    const completed: string[] = [];
    const quota = await classifyHeldOut(quotaRows, {
      apiKey: "test-key",
      maxAttempts: 2,
      sleep: async () => {},
      onCompleted: (prediction) => {
        completed.push(prediction.id);
      },
      fetchImpl: async (_input, init) => {
        quotaCalls += 1;
        if (quotaCalls === 1) return levelResponse(requestText(init));
        return new Response(
          JSON.stringify({
            error: {
              message:
                "You exceeded your current quota, please check your plan and billing details.",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
          { status: 429 },
        );
      },
    });

    expect(quotaCalls).toBe(2);
    expect(quotaSplit.test.length).toBeGreaterThan(2);
    expect(completed).toEqual([quotaSplit.test[0]!.id]);
    expect(quota.summary.classified).toBe(1);
    expect(quota.summary.accuracy).toBe(1);
    expect(quota.summary.infrastructureErrors).toBe(1);
    expect(quota.summary.notAttempted).toBe(quotaSplit.test.length - 2);
    expect(shouldWriteReport(quota.summary)).toBe(false);
    expect(reportMeetsBar(quota.report)).toBe(false);
  });

  it("counts an invalid model reply as a classification error and retries a server error", async () => {
    const rows = labelledLevelRows().slice(0, 10);
    const split = splitLabelledRows(rows, 42);
    let calls = 0;
    const result = await classifyHeldOut(rows, {
      apiKey: "test-key",
      sleep: async () => {},
      fetchImpl: async (_input, init) => {
        calls += 1;
        const text = requestText(init);
        if (calls === 1) return new Response("unavailable", { status: 503 });
        if (courseSection(text).includes(split.test[0]!.title)) {
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: '{"level":"nope"}' }] } }],
            }),
            { status: 200 },
          );
        }
        return levelResponse(text);
      },
    });

    expect(calls).toBe(split.test.length + 1);
    expect(result.summary.classified).toBe(split.test.length);
    expect(result.summary.invalid).toBe(1);
    expect(result.summary.infrastructureErrors).toBe(0);
    expect(result.summary.accuracy).toBe((split.test.length - 1) / split.test.length);
    expect(shouldWriteReport(result.summary)).toBe(false);
  });

  it("does not let the script update courses or the RAG seed", () => {
    const source = readFileSync(resolve(root, "scripts/level-accuracy.ts"), "utf8");
    expect(source).not.toContain("@supabase/supabase-js");
    expect(source).not.toContain(".from(");
    expect(source).not.toContain("rag_chunks");
    expect(source).not.toContain("seed-rag-chunks");
    expect(source).toContain("level-progress.json");
    expect(source).toContain("levelAccuracyReportPath");
    expect(source).toContain("levelProviderFromArgs");
    expect(source).not.toMatch(/console\.(log|error)\([^)]*GEMINI_API_KEY/);
    expect(source).not.toMatch(/console\.(log|error)\([^)]*OLLAMA_HOST/);
  });
});

describe("level classification metrics", () => {
  it("scores per-class and macro precision, recall, and F1", () => {
    const summary = scorePredictions(
      [
        prediction("1", "beginner", "beginner"),
        prediction("2", "beginner", "beginner"),
        prediction("3", "intermediate", "advanced"),
        prediction("4", "advanced", null, "invalid"),
        prediction("5", "beginner", null, "infrastructure"),
      ],
      6,
    );

    expect(summary.metrics.perClass.beginner).toMatchObject({
      precision: 1,
      recall: 1,
      f1: 1,
      support: 2,
    });
    expect(summary.metrics.perClass.intermediate).toMatchObject({
      precision: 0,
      recall: 0,
      f1: 0,
      support: 1,
    });
    expect(summary.metrics.perClass.advanced).toMatchObject({
      precision: 0,
      recall: 0,
      f1: 0,
      support: 1,
    });
    expect(summary.metrics.macro.precision).toBeCloseTo(1 / 3);
    expect(summary.metrics.macro.recall).toBeCloseTo(1 / 3);
    expect(summary.metrics.macro.f1).toBeCloseTo(1 / 3);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.coverage).toBeCloseTo(4 / 6);
    expect(heldOutIsComplete(summary)).toBe(false);
    expect(shouldWriteReport(summary)).toBe(false);
    expect(ollamaEvaluationPassed(summary)).toBe(false);
    expect(formatMetric(summary.metrics.macro.f1)).toBe("0.333");
  });

  it("keeps a perfect classified subset from passing while rows remain", () => {
    const summary = scorePredictions(
      [
        prediction("1", "beginner", "beginner"),
        prediction("2", "intermediate", "intermediate"),
        prediction("3", "advanced", "advanced"),
      ],
      40,
    );

    expect(summary.accuracy).toBe(1);
    expect(summary.metrics.macro.f1).toBe(1);
    expect(summary.coverage).toBeCloseTo(3 / 40);
    expect(summary.notAttempted).toBe(37);
    expect(heldOutIsComplete(summary)).toBe(false);
    expect(ollamaEvaluationPassed(summary)).toBe(false);

    const complete = scorePredictions(
      [
        prediction("1", "beginner", "beginner"),
        prediction("2", "intermediate", "intermediate"),
        prediction("3", "advanced", "advanced"),
      ],
      3,
    );
    expect(complete.metrics.macro.precision).toBe(1);
    expect(complete.metrics.macro.recall).toBe(1);
    expect(complete.metrics.macro.f1).toBe(1);
    expect(ollamaEvaluationPassed(complete)).toBe(true);
  });
});

describe("model-specific level progress", () => {
  it("treats an unlabelled saved row as Gemini and keeps other models beside it", () => {
    const legacy = normalizeSavedPrediction({ id: "label-0001", predicted: "beginner" });
    const ollama = normalizeSavedPrediction({
      id: "label-0001",
      predicted: "advanced",
      provider: "ollama",
      model: "llama3.2",
    });
    const otherModel = normalizeSavedPrediction({
      id: "label-0002",
      predicted: "intermediate",
      provider: "ollama",
      model: "phi3",
    });

    expect(legacy).toMatchObject({
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      predicted: "beginner",
    });
    const saved = mergeSavedPredictions(mergeSavedPredictions([legacy!], ollama!), otherModel!);
    expect(predictionsForModel(saved, "gemini", "gemini-3.5-flash-lite")).toEqual([legacy]);
    expect(predictionsForModel(saved, "ollama", "llama3.2")).toEqual([ollama]);
    expect(predictionsForModel(saved, "ollama", "phi3")).toEqual([otherModel]);
    expect(levelProviderFromArgs(["--provider", "ollama"], { LEVEL_PROVIDER: "gemini" })).toEqual({
      ok: true,
      provider: "ollama",
    });
    expect(levelProviderFromArgs([], {})).toEqual({ ok: true, provider: "gemini" });
    expect(levelProviderFromArgs(["--provider"], {}).ok).toBe(false);
    expect(replaceGeminiReportRequested(["--provider", "ollama"])).toBe(false);
    expect(replaceGeminiReportRequested(["--replace-gemini-report"])).toBe(true);
    expect(levelAccuracyReportPath("ollama")).toBe("docs/assessment-2/level-accuracy-ollama.md");
    expect(levelAccuracyReportPath("gemini")).toBe("docs/assessment-2/level-accuracy.md");
  });

  it("does not resume a Gemini prediction when classifying with Ollama", async () => {
    const rows = labelledLevelRows().slice(0, 10);
    const split = splitLabelledRows(rows, 42);
    const calls: string[] = [];
    const completed: string[] = [];
    const result = await classifyHeldOut(rows, {
      provider: "ollama",
      model: "llama3.2",
      ollamaHost: "http://127.0.0.1:11434",
      saved: [
        { id: split.test[0]!.id, predicted: split.test[0]!.level },
        {
          id: split.test[1]!.id,
          predicted: "beginner",
          provider: "ollama",
          model: "phi3",
        },
      ],
      sleep: async () => {},
      onCompleted: (prediction) => {
        completed.push(`${prediction.provider}:${prediction.model}:${prediction.id}`);
      },
      fetchImpl: async (input, init) => {
        expect(String(input)).toBe("http://127.0.0.1:11434/api/chat");
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          stream: boolean;
          format: string;
          options: { temperature: number };
          messages: Array<{ role: string; content: string }>;
        };
        expect(body.model).toBe("llama3.2");
        expect(body.stream).toBe(false);
        expect(body.format).toBe("json");
        expect(body.options.temperature).toBe(0);
        const course = courseSection(body.messages.at(-1)?.content ?? "");
        calls.push(course);
        return ollamaLevelResponse(course);
      },
    });

    expect(calls).toHaveLength(split.test.length);
    expect(calls.some((course) => course.includes(split.test[0]!.title))).toBe(true);
    expect(completed.every((item) => item.startsWith("ollama:llama3.2:"))).toBe(true);
    expect(result.summary.classified).toBe(split.test.length);
    expect(result.summary.accuracy).toBe(1);
    expect(heldOutIsComplete(result.summary)).toBe(true);
    expect(result.report).toContain("# Course level accuracy (Ollama)");
    expect(result.report).toContain("`llama3.2`");
    expect(result.report).toContain("docs/assessment-2/level-accuracy.md");
    expect(result.report).not.toContain("`gemini-3.5-flash-lite`");
    expect(result.report).not.toContain("photosynthesis");

    const resumedCalls: string[] = [];
    await classifyHeldOut(rows, {
      provider: "ollama",
      model: "llama3.2",
      saved: [
        {
          id: split.test[0]!.id,
          predicted: split.test[0]!.level,
          provider: "ollama",
          model: "llama3.2",
        },
      ],
      sleep: async () => {},
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          messages: Array<{ content: string }>;
        };
        const course = courseSection(body.messages.at(-1)?.content ?? "");
        resumedCalls.push(course);
        return ollamaLevelResponse(course);
      },
    });
    expect(resumedCalls).toHaveLength(split.test.length - 1);
    expect(resumedCalls.some((course) => course.includes(split.test[0]!.title))).toBe(false);
  });

  it("stops an incomplete Ollama run without treating it as a finished evaluation", async () => {
    const rows = labelledLevelRows().slice(0, 15);
    const split = splitLabelledRows(rows, 42);
    let calls = 0;
    const result = await classifyHeldOut(rows, {
      provider: "ollama",
      model: "llama3.2",
      maxAttempts: 2,
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1;
        throw new Error("connection refused");
      },
    });

    expect(calls).toBe(2);
    expect(result.summary.infrastructureErrors).toBe(1);
    expect(result.summary.notAttempted).toBe(split.test.length - 1);
    expect(heldOutIsComplete(result.summary)).toBe(false);
    expect(ollamaEvaluationPassed(result.summary)).toBe(false);
    expect(result.report).toContain("| Not attempted |");
  });
});

describe("published Gemini level baseline", () => {
  it("still records the partial Gemini result", () => {
    const report = readFileSync(resolve(root, "docs/assessment-2/level-accuracy.md"), "utf8");
    expect(report).toContain("`gemini-3.5-flash-lite`");
    expect(report).toContain("| Classified | 32 |");
    expect(report).toContain("| Test count | 40 |");
    expect(report).not.toContain("(Ollama)");
  });
});

function prediction(
  id: string,
  actual: CourseLevel,
  predicted: CourseLevel | null,
  outcome?: LevelOutcome,
) {
  return {
    id,
    actual,
    predicted,
    outcome: outcome ?? (predicted ? "classified" : "invalid"),
  };
}

function requestText(init: RequestInit | undefined) {
  const body = JSON.parse(String(init?.body)) as {
    contents: Array<{ parts: Array<{ text: string }> }>;
  };
  return body.contents[0]?.parts[0]?.text ?? "";
}

function courseSection(text: string) {
  return text.split("Course to classify:").at(-1) ?? "";
}

function ollamaLevelResponse(course: string) {
  const predicted = course.includes("Beginner introduction")
    ? "beginner"
    : course.includes("Intermediate practice")
      ? "intermediate"
      : "advanced";
  return new Response(
    JSON.stringify({ message: { content: JSON.stringify({ level: predicted }) } }),
    { status: 200 },
  );
}

function levelResponse(text: string) {
  const course = courseSection(text);
  const predicted = course.includes("Beginner introduction")
    ? "beginner"
    : course.includes("Intermediate practice")
      ? "intermediate"
      : "advanced";
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ level: predicted }) }] } }],
    }),
    { status: 200 },
  );
}

function diagonal(matrix: Record<CourseLevel, Record<CourseLevel, number>>) {
  return levelNames.reduce((sum, level) => sum + matrix[level][level], 0);
}
