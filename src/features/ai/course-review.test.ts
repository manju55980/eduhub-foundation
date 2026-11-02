import { describe, expect, it, vi } from "vitest";

import {
  courseIdFromBody,
  findingCount,
  findingLimit,
  parseReviewReply,
  reviewPrompt,
  sortReviewLessons,
  summaryLimit,
  type ReviewLesson,
} from "../../../supabase/functions/_shared/course-review.ts";
import {
  invalidAiMessage,
  missingAiMessage,
  failedAiMessage,
} from "../../../supabase/functions/_shared/gemini.ts";
import { isLowConfidence } from "../../../supabase/functions/_shared/guardrails.ts";
import { handleCourseReview } from "../../../supabase/functions/_shared/handle-course-review.ts";
import {
  bindReviewReader,
  type ReviewDb,
  type ReviewInsert,
  type ReviewReader,
} from "../../../supabase/functions/_shared/review-reader.ts";
import {
  reviewAssignmentColumns,
  reviewCourseColumns,
  reviewLessonColumns,
  reviewMaterialColumns,
  reviewRoleColumns,
} from "../../../supabase/functions/_shared/review-query.ts";

const courseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const apiKey = "AIzaSyTestKeyValue1234567890";

function bearer() {
  return `Bearer ${jwt({ sub: "admin-1" })}`;
}

function jwt(payload: Record<string, string>) {
  return `${btoa(JSON.stringify({ alg: "none", typ: "JWT" }))}.${btoa(JSON.stringify(payload))}.sig`;
}

function post(body: unknown) {
  return new Request("http://localhost/ai-course-review", {
    method: "POST",
    headers: { Authorization: bearer() },
    body: JSON.stringify(body),
  });
}

function modelReply(value: unknown) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function reviewBody(confidence = 0.91) {
  return {
    recommendation: "recommend",
    confidence,
    summary: "The lessons build in order.",
    findings: ["Add a practice task."],
  };
}

function lesson(title: string, orderIndex: number | null, createdAt: string): ReviewLesson {
  return { title, content: `${title} text`, orderIndex, createdAt };
}

function reader(options?: {
  role?: string | null;
  course?: {
    title: string | null;
    description: string | null;
    level: string;
    status: string;
  } | null;
  lessons?: ReviewLesson[];
  failUser?: boolean;
}): { reader: ReviewReader; calls: string[]; inserted: ReviewInsert[] } {
  const calls: string[] = [];
  const inserted: ReviewInsert[] = [];
  const course = options && "course" in options ? options.course : pendingCourse();
  return {
    calls,
    inserted,
    reader: {
      async userId() {
        calls.push("user");
        if (options?.failUser) return { ok: false, message: "You need to be signed in." };
        return { ok: true, userId: "admin-1" };
      },
      async role() {
        calls.push("role");
        return { ok: true, role: options?.role ?? "admin" };
      },
      async course() {
        calls.push("course");
        return { ok: true, course: course ?? null };
      },
      async lessons() {
        calls.push("lessons");
        return { ok: true, lessons: options?.lessons ?? [lesson("Intro", 1, "2026-01-01")] };
      },
      async assignments() {
        calls.push("assignments");
        return {
          ok: true,
          assignments: [{ title: "Worksheet", description: "Practice", dueDate: null }],
        };
      },
      async materials() {
        calls.push("materials");
        return {
          ok: true,
          materials: [{ fileName: "notes.pdf", mimeType: "application/pdf" }],
        };
      },
      async insertReview(row) {
        calls.push("insert");
        inserted.push(row);
        return {
          ok: true,
          review: {
            recommendation: row.recommendation,
            confidence: row.confidence,
            lowConfidence: isLowConfidence(row.confidence),
            summary: row.summary,
            findings: row.findings,
          },
        };
      },
    },
  };
}

function pendingCourse() {
  return {
    title: "Plant care",
    description: "Learn to water plants.",
    level: "beginner",
    status: "pending",
  };
}

function deps(
  tracked: ReturnType<typeof reader>,
  fetchImpl: typeof fetch,
  extra?: {
    geminiKey?: string | undefined;
    publishableKey?: string;
    authorization?: string | null;
  },
) {
  return {
    supabaseUrl: "http://localhost:54321",
    publishableKey: extra?.publishableKey ?? "sb_publishable_test",
    geminiKey: extra && "geminiKey" in extra ? extra.geminiKey : apiKey,
    authorization: extra && "authorization" in extra ? (extra.authorization ?? null) : bearer(),
    reader: tracked.reader,
    fetchImpl,
  };
}

describe("course review prompt and parser", () => {
  it("redacts contact details and sends file names without file contents", () => {
    const prompt = reviewPrompt({
      course: {
        title: "Email ada@example.com",
        description: "Call 5551234567",
        level: "beginner",
      },
      lessons: [lesson("Lesson 3", 1, "2026-01-01")],
      assignments: [{ title: "Grade 7", description: "One task", dueDate: null }],
      materials: [{ fileName: "notes.pdf", mimeType: "application/pdf" }],
    });

    expect(prompt.system).toContain("lesson structure");
    expect(prompt.system).toContain("progression");
    expect(prompt.system).toContain("material metadata");
    expect(prompt.user).toContain("notes.pdf");
    expect(prompt.user).toContain("application/pdf");
    expect(prompt.user).toContain("Lesson 3");
    expect(prompt.user).toContain("Grade 7");
    expect(prompt.user).toContain("[redacted]");
    expect(prompt.user).toContain("[untrusted course]");
    expect(prompt.user).not.toContain("ada@example.com");
    expect(prompt.user).not.toContain("5551234567");
    expect(prompt.user).not.toContain("storage_path");
    expect(prompt.user).not.toContain("full_name");
  });

  it("orders lessons by index and places a missing index last", () => {
    const sorted = sortReviewLessons([
      lesson("Missing", null, "2026-01-01"),
      lesson("Second", 2, "2026-01-01"),
      lesson("First", 1, "2026-01-03"),
    ]);
    expect(sorted.map((item) => item.title)).toEqual(["First", "Second", "Missing"]);
  });

  it("keeps a low score, drops extra findings, and limits text length", () => {
    const summary = "s".repeat(summaryLimit + 25);
    const findings = Array.from({ length: findingCount + 1 }, (_, index) =>
      index === 0 ? "f".repeat(findingLimit + 20) : `finding ${index}`,
    );
    const parsed = parseReviewReply({
      recommendation: " revise ",
      confidence: 0.69,
      summary,
      findings,
      status: "published",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.review.recommendation).toBe("revise");
    expect(parsed.review.lowConfidence).toBe(true);
    expect(parsed.review.summary).toHaveLength(summaryLimit);
    expect(parsed.review.findings).toHaveLength(findingCount);
    expect(parsed.review.findings[0]?.length).toBe(findingLimit);
    expect(parsed.review).not.toHaveProperty("status");
  });

  it("rejects a missing recommendation, a confidence outside 0 to 1, and a blank summary", () => {
    expect(parseReviewReply({ confidence: 0.8, summary: "Ok", findings: [] }).ok).toBe(false);
    expect(
      parseReviewReply({ recommendation: "recommend", confidence: 1.1, summary: "Ok" }).ok,
    ).toBe(false);
    expect(parseReviewReply({ recommendation: "approve", confidence: 0.8, summary: "Ok" }).ok).toBe(
      false,
    );
    expect(
      parseReviewReply({ recommendation: "recommend", confidence: 0.8, summary: "  " }).ok,
    ).toBe(false);
    expect(courseIdFromBody({ courseId: "not-a-course" }).ok).toBe(false);
  });
});

describe("ai-course-review", () => {
  it("rejects a student or instructor before reading the course", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const role of ["student", "instructor"]) {
      const tracked = reader({ role });
      const response = await handleCourseReview(post({ courseId }), deps(tracked, fetchImpl));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        message: "Only an admin can review a course.",
      });
      expect(tracked.calls).toEqual(["user", "role"]);
      expect(tracked.inserted).toEqual([]);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a service-role key before reading the course", async () => {
    const serviceKey = jwt({ role: "service_role" });
    const tracked = reader();
    const response = await handleCourseReview(
      post({ courseId }),
      deps(tracked, vi.fn<typeof fetch>(), { publishableKey: serviceKey }),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ ok: false, message: missingAiMessage });
    expect(tracked.calls).toEqual([]);
  });

  it("does not call Gemini for a course that is not pending", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const status of ["draft", "published", "archived"]) {
      const tracked = reader({
        course: { ...pendingCourse(), status },
      });
      const response = await handleCourseReview(post({ courseId }), deps(tracked, fetchImpl));
      await expect(response.json()).resolves.toEqual({
        ok: false,
        message: "This course is not waiting for approval.",
      });
      expect(tracked.calls).toEqual(["user", "role", "course"]);
      expect(tracked.inserted).toEqual([]);
    }
    const missing = reader({ course: null });
    await handleCourseReview(post({ courseId: "not-a-course" }), deps(missing, fetchImpl));
    expect(missing.calls).toEqual(["user", "role"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stores recommend and revise without a course status change", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => modelReply(reviewBody(0.7)));
    const tracked = reader();
    const response = await handleCourseReview(
      post({ courseId, ignored: true }),
      deps(tracked, fetchImpl),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      recommendation: "recommend",
      confidence: 0.7,
      lowConfidence: false,
      summary: "The lessons build in order.",
      findings: ["Add a practice task."],
    });
    expect(tracked.inserted).toEqual([
      {
        course_id: courseId,
        recommendation: "recommend",
        confidence: 0.7,
        summary: "The lessons build in order.",
        findings: ["Add a practice task."],
      },
    ]);
    expect(tracked.inserted[0]).not.toHaveProperty("status");

    const reviseFetch = vi.fn<typeof fetch>(async () =>
      modelReply({ ...reviewBody(0.69), recommendation: "revise" }),
    );
    const revise = reader();
    const reviseResponse = await handleCourseReview(post({ courseId }), deps(revise, reviseFetch));
    await expect(reviseResponse.json()).resolves.toMatchObject({
      ok: true,
      recommendation: "revise",
      confidence: 0.69,
      lowConfidence: true,
    });
    expect(revise.inserted[0]?.recommendation).toBe("revise");
    expect(revise.calls).not.toContain("update");
  });

  it("sends redacted course text and material metadata to Gemini", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => modelReply(reviewBody()));
    const tracked = reader({
      course: {
        title: "Email ada@example.com",
        description: "Objectives",
        level: "intermediate",
        status: "pending",
      },
      lessons: [lesson("Later", 2, "2026-01-02"), lesson("Earlier", 1, "2026-01-03")],
    });
    await handleCourseReview(post({ courseId }), deps(tracked, fetchImpl));
    const init = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    const user = body.contents[0]?.parts[0]?.text ?? "";
    const requestUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("generativelanguage.googleapis.com");
    expect(requestUrl).not.toContain("storage");
    expect(user).toContain("notes.pdf");
    expect(user).toContain("application/pdf");
    expect(user.indexOf("Earlier")).toBeLessThan(user.indexOf("Later"));
    expect(user).not.toContain("ada@example.com");
    expect(body.systemInstruction.parts[0]?.text).toContain("cannot see file contents");
  });

  it("inserts nothing when Gemini is missing, fails, asks for a tool, or replies invalidly", async () => {
    const missing = reader();
    const missingResponse = await handleCourseReview(
      post({ courseId }),
      deps(missing, vi.fn<typeof fetch>(), { geminiKey: undefined }),
    );
    await expect(missingResponse.json()).resolves.toMatchObject({
      ok: false,
      message: missingAiMessage,
    });
    expect(missing.inserted).toEqual([]);

    const failedReader = reader();
    const failed = await handleCourseReview(
      post({ courseId }),
      deps(
        failedReader,
        vi.fn<typeof fetch>(async () => new Response("down", { status: 500 })),
      ),
    );
    await expect(failed.json()).resolves.toMatchObject({ ok: false, message: failedAiMessage });
    expect(failedReader.inserted).toEqual([]);

    const toolReader = reader();
    const tool = await handleCourseReview(
      post({ courseId }),
      deps(
        toolReader,
        vi.fn<typeof fetch>(async () =>
          modelReply({ type: "tool", name: "enrol_in_course", arguments: {} }),
        ),
      ),
    );
    await expect(tool.json()).resolves.toMatchObject({ ok: false, message: invalidAiMessage });
    expect(toolReader.inserted).toEqual([]);

    const invalidReader = reader();
    const invalid = await handleCourseReview(
      post({ courseId }),
      deps(
        invalidReader,
        vi.fn<typeof fetch>(async () => modelReply({ recommendation: "recommend", confidence: 2 })),
      ),
    );
    await expect(invalid.json()).resolves.toMatchObject({ ok: false, message: invalidAiMessage });
    expect(invalidReader.inserted).toEqual([]);
    expect(invalidReader.calls).not.toContain("insert");
  });
});

describe("course review reader", () => {
  it("reads role, pending course text, and material names, then inserts only a review", async () => {
    const calls: string[] = [];
    const db = queryDb(
      {
        profiles: () => ({ data: { role: "admin" }, error: null }),
        courses: () => ({
          data: { title: "Plants", description: "Water", level: "beginner", status: "pending" },
          error: null,
        }),
        lessons: () => ({
          data: [
            { title: "Missing", content: "later", order_index: null, created_at: "2026-01-01" },
            { title: "Second", content: "next", order_index: 2, created_at: "2026-01-02" },
            { title: "First", content: "start", order_index: 1, created_at: "2026-01-03" },
          ],
          error: null,
        }),
        assignments: () => ({
          data: [{ title: "Task", description: "Do it", due_date: "2026-02-01" }],
          error: null,
        }),
        course_materials: () => ({
          data: [
            {
              file_name: "notes.pdf",
              mime_type: "application/pdf",
              storage_path: "secret/path",
              byte_size: 10,
            },
          ],
          error: null,
        }),
        course_reviews: () => ({
          data: {
            recommendation: "recommend",
            confidence: "0.70",
            summary: "Sound",
            findings: ["Keep it"],
          },
          error: null,
        }),
      },
      calls,
    );
    const bound = bindReviewReader(db, "header.payload.sig");
    await bound.role("admin-1");
    const course = await bound.course(courseId);
    const lessons = await bound.lessons(courseId);
    await bound.assignments(courseId);
    const materials = await bound.materials(courseId);
    const saved = await bound.insertReview({
      course_id: courseId,
      recommendation: "recommend",
      confidence: 0.7,
      summary: "Sound",
      findings: ["Keep it"],
    });

    expect(course.ok && course.course?.status).toBe("pending");
    expect(lessons.ok && lessons.lessons.map((item) => item.title)).toEqual([
      "First",
      "Second",
      "Missing",
    ]);
    expect(materials.ok && materials.materials).toEqual([
      { fileName: "notes.pdf", mimeType: "application/pdf" },
    ]);
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.review.lowConfidence).toBe(false);
    expect(calls).toContain(`select:profiles:${reviewRoleColumns}`);
    expect(calls).toContain(`select:courses:${reviewCourseColumns}`);
    expect(calls).toContain(`select:lessons:${reviewLessonColumns}`);
    expect(calls).toContain(`select:assignments:${reviewAssignmentColumns}`);
    expect(calls).toContain(`select:course_materials:${reviewMaterialColumns}`);
    expect(calls).toContain(
      "insert:course_reviews:confidence,course_id,findings,recommendation,summary",
    );
    expect(calls.join(" ")).not.toContain("storage_path");
    expect(calls.join(" ")).not.toContain("email");
    expect(calls.join(" ")).not.toContain("full_name");
    expect(calls.join(" ")).not.toContain("update");
    expect(reviewMaterialColumns).not.toContain("byte_size");
  });
});

type QueryResult = { data: unknown; error: { message: string } | null };

function queryDb(tables: Record<string, () => QueryResult>, calls: string[]): ReviewDb {
  return {
    auth: {
      async getUser() {
        calls.push("auth.getUser");
        return { data: { user: { id: "admin-1" } }, error: null };
      },
    },
    from(table) {
      const builder = {
        select(columns: string) {
          calls.push(`select:${table}:${columns}`);
          return builder;
        },
        eq() {
          return builder;
        },
        order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
          calls.push(`order:${table}:${column}:${String(options?.nullsFirst)}`);
          return builder;
        },
        insert(row: ReviewInsert) {
          calls.push(`insert:${table}:${Object.keys(row).sort().join(",")}`);
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(tables[table]?.() ?? { data: null, error: null });
        },
        single() {
          return Promise.resolve(tables[table]?.() ?? { data: null, error: null });
        },
        then<TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ): PromiseLike<TResult1 | TResult2> {
          return Promise.resolve(tables[table]?.() ?? { data: [], error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };
      return builder;
    },
  };
}
