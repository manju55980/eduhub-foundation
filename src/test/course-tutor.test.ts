import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AiRateDb } from "../../supabase/functions/_shared/ai-rate-limit.ts";
import {
  graderPrompt,
  keepTutorChunks,
  lowConfidenceGradeMessage,
  lowConfidencePlanMessage,
  nextDifficulty,
  noEvidenceMessage,
  noLessonsMessage,
  parseTutorPlan,
  plannerPrompt,
  studentOnlyTutorMessage,
  type TutorChunk,
  type TutorLesson,
} from "../../supabase/functions/_shared/course-tutor.ts";
import type { TutorReader } from "../../supabase/functions/_shared/course-tutor-reader.ts";
import { handleCourseTutor } from "../../supabase/functions/_shared/handle-course-tutor.ts";
import { createMemoryThreads } from "../../supabase/functions/_shared/ai-thread.ts";
import { embeddingRejectedMessage } from "../../supabase/functions/_shared/embeddings.ts";
import { invalidAiMessage } from "../../supabase/functions/_shared/gemini.ts";
import { notAvailableMessage } from "../../supabase/functions/_shared/study.ts";

const root = resolve(process.cwd());
const courseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const lessonId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherLessonId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const chunkId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const otherChunkId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const faqId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const userId = "user-1";

const lessons: TutorLesson[] = [
  { id: lessonId, title: "Sums", orderIndex: 1 },
  { id: otherLessonId, title: "Products", orderIndex: 0 },
];

function bearer() {
  const payload = btoa(JSON.stringify({ sub: userId }));
  return `Bearer ${btoa(JSON.stringify({ alg: "none", typ: "JWT" }))}.${payload}.sig`;
}

function post(body: unknown) {
  return new Request("http://localhost/ai-tutor", {
    method: "POST",
    headers: { Authorization: bearer() },
    body: JSON.stringify(body),
  });
}

function gemini(value: unknown) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function ollama() {
  return new Response(JSON.stringify({ embeddings: [Array.from({ length: 768 }, () => 0.1)] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function rateDb(data: unknown, calls: string[]): AiRateDb {
  return {
    async rpc(fn, args) {
      calls.push(`${fn}:${JSON.stringify(args)}`);
      return { data, error: null };
    },
  };
}

function reader(options?: {
  role?: string;
  enrolled?: boolean;
  lessons?: TutorLesson[];
  matches?: TutorChunk[];
  course?: { title: string | null } | null;
}): TutorReader & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async userId() {
      calls.push("userId");
      return { ok: true, userId };
    },
    async role() {
      calls.push("role");
      return { ok: true, role: options?.role ?? "student" };
    },
    async course() {
      calls.push("course");
      return {
        ok: true,
        course: options?.course === undefined ? { title: "Algebra" } : options.course,
      };
    },
    async enrolled() {
      calls.push("enrolled");
      return { ok: true, enrolled: options?.enrolled ?? true };
    },
    async lessons() {
      calls.push("lessons");
      return { ok: true, lessons: options?.lessons ?? lessons };
    },
    async matchKnowledge() {
      calls.push("match");
      return { ok: true, matches: options?.matches ?? [] };
    },
  };
}

function deps(
  fetchImpl: typeof fetch,
  tutor: TutorReader,
  rateLimit?: AiRateDb,
  geminiKey: string | undefined = "test-gemini-key",
) {
  return {
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "publishable-key",
    geminiKey,
    ollamaHost: "http://127.0.0.1:11434",
    authorization: bearer(),
    reader: tutor,
    fetchImpl,
    ...(rateLimit ? { rateLimit } : {}),
  };
}

const requestBody = {
  courseId,
  mode: "grade" as const,
  question: "What is addition? Email me at student@example.com",
  answer: "Addition combines numbers. Call 555-010-0199.",
};

describe("course tutor parsing", () => {
  it("drops an invented lesson and keeps the course order from the model", () => {
    const plan = parseTutorPlan(
      {
        confidence: 0.7,
        lessons: [
          { id: lessonId, reason: "Start here" },
          { id: "not-a-lesson", reason: "Invented" },
          { id: lessonId, reason: "Again" },
          { id: otherLessonId, reason: "Then this" },
        ],
      },
      lessons,
    );
    expect(plan).toEqual({
      ok: true,
      plan: [
        { id: lessonId, title: "Sums", orderIndex: 1 },
        { id: otherLessonId, title: "Products", orderIndex: 0 },
      ],
    });
  });

  it("keeps faq chunks and this course only", () => {
    const chunks: TutorChunk[] = [
      {
        id: chunkId,
        sourceType: "lesson",
        title: "Sums",
        body: "Add numbers",
        courseId,
        similarity: 0.8,
      },
      {
        id: otherChunkId,
        sourceType: "lesson",
        title: "Other",
        body: "Hidden",
        courseId: otherLessonId,
        similarity: 0.9,
      },
      {
        id: faqId,
        sourceType: "faq",
        title: "FAQ",
        body: "A public answer",
        courseId: null,
        similarity: 0.6,
      },
    ];
    expect(keepTutorChunks(chunks, courseId).map((chunk) => chunk.id)).toEqual([chunkId, faqId]);
  });

  it("redacts the question before it is placed in the planner prompt", () => {
    const prompt = plannerPrompt({
      courseTitle: "Algebra",
      lessons,
      question: requestBody.question,
    });
    expect(prompt.user).toContain("[redacted]");
    expect(prompt.user).not.toContain("student@example.com");
    expect(prompt.user).not.toContain(userId);
    expect(prompt.user).toContain(otherLessonId);
    expect(prompt.user.indexOf(otherLessonId)).toBeLessThan(prompt.user.indexOf(lessonId));
  });

  it("redacts the answer in the grader prompt and does not ask for a numeric score", () => {
    const prompt = graderPrompt({
      question: requestBody.question,
      answer: requestBody.answer,
      plan: [{ id: lessonId, title: "Sums", orderIndex: 1 }],
      context: [
        {
          id: chunkId,
          sourceType: "lesson",
          title: "Sums",
          body: "Email the tutor at tutor@example.com",
          similarity: 0.8,
        },
      ],
    });
    expect(prompt.user).not.toContain("student@example.com");
    expect(prompt.user).not.toContain("555-010-0199");
    expect(prompt.user).not.toContain("tutor@example.com");
    expect(prompt.system).toContain("Do not return a numeric score");
  });
});

describe("course tutor handler", () => {
  it("returns a plan, this course's context, and a cited verdict", async () => {
    const calls: string[] = [];
    const bodies: string[] = [];
    const tutor = reader({
      matches: [
        {
          id: chunkId,
          sourceType: "lesson",
          title: "Sums",
          body: "Add numbers",
          courseId,
          similarity: 0.82,
        },
        {
          id: otherChunkId,
          sourceType: "lesson",
          title: "Other",
          body: "Hidden lesson",
          courseId: otherLessonId,
          similarity: 0.99,
        },
        {
          id: faqId,
          sourceType: "faq",
          title: "FAQ",
          body: "Addition is combining",
          courseId: null,
          similarity: 0.7,
        },
      ],
    });
    let generates = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      bodies.push(typeof init?.body === "string" ? init.body : "");
      if (url.includes("/api/embed")) return ollama();
      generates += 1;
      if (generates === 1) {
        return gemini({
          confidence: 0.91,
          lessons: [
            { id: lessonId, reason: "Start with sums" },
            { id: "invented-lesson", reason: "Not in the course" },
          ],
        });
      }
      return gemini({
        confidence: 0.88,
        verdict: "partial",
        feedback: "The answer matches the cited lesson.",
        citations: [chunkId, otherChunkId, "missing"],
        score: 9,
      });
    });

    const response = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, tutor, rateDb(true, calls)),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      mode: "grade",
      refused: false,
      question: requestBody.question,
      plan: [{ id: lessonId, title: "Sums", orderIndex: 1 }],
      feedback: {
        verdict: "partial",
        feedback: "The answer matches the cited lesson.",
        citations: [{ id: chunkId, title: "Sums" }],
      },
    });
    expect(body.context.map((chunk: { id: string }) => chunk.id)).toEqual([chunkId, faqId]);
    expect(JSON.stringify(body)).not.toContain("Hidden lesson");
    expect(JSON.stringify(body)).not.toContain("score");
    expect(calls).toEqual(['consume_ai_request:{"requested_feature":"ai-tutor"}']);
    expect(bodies.some((item) => item.includes("student@example.com"))).toBe(false);
    expect(tutor.calls).not.toContain("insert");
  });

  it("asks one question and does not return the chunk text", async () => {
    const tutor = reader({
      matches: [
        {
          id: chunkId,
          sourceType: "lesson",
          title: "Sums",
          body: "Add the numbers together",
          courseId,
          similarity: 0.8,
        },
      ],
    });
    let generates = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes("/api/embed")) return ollama();
      generates += 1;
      if (generates === 1) {
        return gemini({ confidence: 0.9, lessons: [{ id: lessonId, reason: "Start" }] });
      }
      return gemini({
        confidence: 0.86,
        question: "What does addition do?",
        citations: [chunkId],
      });
    });

    const response = await handleCourseTutor(
      post({ courseId, mode: "question" }),
      deps(fetchImpl, tutor, rateDb(true, [])),
    );
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      mode: "question",
      refused: false,
      question: "What does addition do?",
      difficulty: "starting",
      plan: [{ id: lessonId, title: "Sums", orderIndex: 1 }],
    });
    expect(JSON.stringify(body)).not.toContain("Add the numbers together");
  });

  it("asks a harder question after a supported answer and an easier one after a partial answer", async () => {
    expect(nextDifficulty([])).toBe("starting");
    expect(
      nextDifficulty([{ role: "assistant", content: "supported: The cited text matches." }]),
    ).toBe("harder");
    expect(
      nextDifficulty([{ role: "assistant", content: "partial: Only one part matches." }]),
    ).toBe("easier");
    expect(
      nextDifficulty([{ role: "assistant", content: "unsupported: The text does not match." }]),
    ).toBe("easier");

    const threadId = "11111111-1111-4111-8111-111111111111";
    const threads = createMemoryThreads([
      {
        id: threadId,
        surface: "tutor",
        courseId,
        messages: [
          { role: "user", content: "Give me a question" },
          { role: "assistant", content: "What does addition do?" },
          { role: "user", content: "It combines numbers" },
          { role: "assistant", content: "supported: The cited lesson supports the answer." },
        ],
      },
    ]);
    const tutor = reader({
      matches: [
        {
          id: chunkId,
          sourceType: "lesson",
          title: "Sums",
          body: "Add the numbers together",
          courseId,
          similarity: 0.8,
        },
      ],
    });
    const prompts: string[] = [];
    let generates = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes("/api/embed")) return ollama();
      generates += 1;
      prompts.push(String(init?.body ?? ""));
      if (generates === 1) {
        return gemini({ confidence: 0.9, lessons: [{ id: lessonId, reason: "Start" }] });
      }
      return gemini({
        confidence: 0.86,
        question: "How do the two facts about addition fit together?",
        citations: [chunkId],
      });
    });

    const response = await handleCourseTutor(post({ courseId, mode: "question", threadId }), {
      ...deps(fetchImpl, tutor, rateDb(true, [])),
      threads,
    });
    const body = await response.json();
    expect(body.difficulty).toBe("harder");
    expect(prompts.some((item) => item.includes("Ask a harder question"))).toBe(true);
    expect(threads.messages(threadId).at(-1)?.content).toContain("How do the two facts");
  });

  it("refuses a low-confidence plan before retrieval or grading", async () => {
    const tutor = reader();
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      gemini({ confidence: 0.69, lessons: [{ id: lessonId, reason: "Start" }] }),
    );
    const response = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, tutor, rateDb(true, [])),
    );
    expect(await response.json()).toEqual({
      ok: true,
      refused: true,
      message: lowConfidencePlanMessage,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(tutor.calls).not.toContain("match");
  });

  it("refuses a grade that cites nothing", async () => {
    const tutor = reader({
      matches: [
        {
          id: chunkId,
          sourceType: "lesson",
          title: "Sums",
          body: "Add numbers",
          courseId,
          similarity: 0.8,
        },
      ],
    });
    let generates = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes("/api/embed")) return ollama();
      generates += 1;
      if (generates === 1) {
        return gemini({ confidence: 0.9, lessons: [{ id: lessonId, reason: "Start" }] });
      }
      return gemini({
        confidence: 0.9,
        verdict: "supported",
        feedback: "Looks right",
        citations: [otherChunkId],
      });
    });
    const response = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, tutor, rateDb(true, [])),
    );
    expect(await response.json()).toEqual({
      ok: true,
      refused: true,
      message: lowConfidenceGradeMessage,
    });
  });

  it("does not grade when no chunk remains", async () => {
    const tutor = reader({
      matches: [
        {
          id: otherChunkId,
          sourceType: "lesson",
          title: "Other",
          body: "Hidden",
          courseId: otherLessonId,
          similarity: 0.9,
        },
      ],
    });
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes("/api/embed")) return ollama();
      return gemini({ confidence: 0.9, lessons: [{ id: lessonId, reason: "Start" }] });
    });
    const response = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, tutor, rateDb(true, [])),
    );
    expect(await response.json()).toEqual({ ok: true, refused: true, message: noEvidenceMessage });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not call the model for another role, a missing course, or a course with no lessons", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>();
    const instructor = reader({ role: "instructor" });
    const missing = reader({ course: null });
    const empty = reader({ lessons: [] });

    const forbidden = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, instructor, rateDb(true, calls)),
    );
    const unavailable = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, missing, rateDb(true, calls)),
    );
    const noLessons = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, empty, rateDb(true, calls)),
    );

    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ ok: false, message: studentOnlyTutorMessage });
    expect(instructor.calls).not.toContain("course");
    expect(await unavailable.json()).toEqual({ ok: false, message: notAvailableMessage });
    expect(missing.calls).not.toContain("lessons");
    expect(await noLessons.json()).toEqual({ ok: false, message: noLessonsMessage });
    expect(calls).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stops at the hourly limit and does not spend a request when Gemini is missing", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>();
    const limited = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, reader(), rateDb(false, calls)),
    );
    const unconfigured = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, reader(), rateDb(true, calls), ""),
    );

    expect(limited.status).toBe(429);
    expect(await unconfigured.json()).toEqual({ ok: false, message: "AI is not configured." });
    expect(calls).toEqual(['consume_ai_request:{"requested_feature":"ai-tutor"}']);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a tool-shaped planner reply", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      gemini({ type: "tool", name: "enrol_in_course", arguments: {} }),
    );
    const response = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, reader(), rateDb(true, [])),
    );
    expect(await response.json()).toEqual({ ok: false, message: invalidAiMessage });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("fails closed when the embedding call fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes("/api/embed")) return new Response("down", { status: 500 });
      return gemini({ confidence: 0.9, lessons: [{ id: lessonId, reason: "Start" }] });
    });
    const response = await handleCourseTutor(
      post(requestBody),
      deps(fetchImpl, reader(), rateDb(true, [])),
    );
    expect(await response.json()).toEqual({ ok: false, message: embeddingRejectedMessage });
  });
});

describe("course tutor boundaries", () => {
  it("adds the hourly limit without a new table and keeps the function on the caller jwt", () => {
    const migration = readFileSync(
      resolve(root, "supabase/migrations/20261123010000_ai_tutor_rate_limit.sql"),
      "utf8",
    );
    const index = readFileSync(resolve(root, "supabase/functions/ai-tutor/index.ts"), "utf8");
    const readerSource = readFileSync(
      resolve(root, "supabase/functions/_shared/course-tutor-reader.ts"),
      "utf8",
    );
    const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");

    expect(migration).toContain("when 'ai-tutor' then 20");
    expect(migration).toContain("'ai-tutor'");
    expect(migration).not.toMatch(/create table/i);
    expect(migration).not.toMatch(/add column/i);
    expect(index).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(readerSource).not.toMatch(/\.insert|\.update|\.delete/);
    expect(readerSource).not.toContain("email");
    expect(readerSource).not.toContain("phone");
    expect(config).toMatch(/\[functions\.ai-tutor\]\s+verify_jwt = true/);
  });
});
