export const faithfulnessThreshold = 1;
export const classifierF1Threshold = 0.8;

export type GateResult = {
  ok: boolean;
  failures: string[];
  vectorFaithfulness: number | null;
  hybridFaithfulness: number | null;
  geminiF1: number | null;
  ollamaF1: number | null;
};

export function evaluateReports(hybridMarkdown: string, levelMarkdown: string): GateResult {
  const failures: string[] = [];
  const faith = readFaithfulness(hybridMarkdown);
  const f1 = readClassifierF1(levelMarkdown);
  if (!faith.ok) failures.push(faith.message);
  if (!f1.ok) failures.push(f1.message);
  if (faith.ok && faith.vector < faithfulnessThreshold) {
    failures.push(`Vector faithfulness ${faith.vector.toFixed(3)} is below 1.000.`);
  }
  if (faith.ok && faith.hybrid < faithfulnessThreshold) {
    failures.push(`Hybrid faithfulness ${faith.hybrid.toFixed(3)} is below 1.000.`);
  }
  if (f1.ok && f1.gemini < classifierF1Threshold) {
    failures.push(`Gemini macro F1 ${f1.gemini.toFixed(3)} is below 0.800.`);
  }
  if (f1.ok && f1.ollama < classifierF1Threshold) {
    failures.push(`Ollama macro F1 ${f1.ollama.toFixed(3)} is below 0.800.`);
  }
  return {
    ok: failures.length === 0,
    failures,
    vectorFaithfulness: faith.ok ? faith.vector : null,
    hybridFaithfulness: faith.ok ? faith.hybrid : null,
    geminiF1: f1.ok ? f1.gemini : null,
    ollamaF1: f1.ok ? f1.ollama : null,
  };
}

function readFaithfulness(markdown: string) {
  const line = markdown.split(/\r?\n/).find((row) => /^\|\s*All\s*\|/.test(row));
  if (!line) return { ok: false as const, message: "The hybrid report has no All row." };
  const cells = cellsOf(line);
  const vector = Number(cells[8]);
  const hybrid = Number(cells[9]);
  if (!Number.isFinite(vector) || !Number.isFinite(hybrid)) {
    return { ok: false as const, message: "The hybrid All row has no faithfulness scores." };
  }
  return { ok: true as const, vector, hybrid };
}

function readClassifierF1(markdown: string) {
  const line = markdown.split(/\r?\n/).find((row) => /^\|\s*F1 \(macro\)\s*\|/.test(row));
  if (!line) return { ok: false as const, message: "The level report has no macro F1 row." };
  const cells = cellsOf(line);
  const gemini = Number(cells[1]);
  const ollama = Number(cells[2]);
  if (!Number.isFinite(gemini) || !Number.isFinite(ollama)) {
    return { ok: false as const, message: "The level report has no macro F1 scores." };
  }
  return { ok: true as const, gemini, ollama };
}

function cellsOf(line: string) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}
