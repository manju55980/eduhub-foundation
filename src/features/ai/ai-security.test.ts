import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { readFunctionResult, sanitizePublicMessage } from "@/features/ai/function-result";
import { startGeneratedSave, type CourseWriter } from "@/features/instructor/course-builder-save";
import { handleCourseBuilder } from "../../../supabase/functions/_shared/handle-course-builder.ts";
import { handleStudy } from "../../../supabase/functions/_shared/handle-study.ts";
import { bindStudyReader, type StudyDb } from "../../../supabase/functions/_shared/study-reader.ts";
import {
  studyCourseColumns,
  studyEnrollmentColumns,
  studyLessonColumns,
  studyRoleColumns,
} from "../../../supabase/functions/_shared/study-query.ts";
import type { StudyReader } from "../../../supabase/functions/_shared/study-reader.ts";
import { resolveUserClient } from "../../../supabase/functions/_shared/user-client.ts";

const courseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function bearer() {
  return `Bearer ${jwt({ sub: "user-1" })}`;
}

function jwt(payload: Record<string, string>) {
  return `${btoa(JSON.stringify({ alg: "none", typ: "JWT" }))}.${btoa(JSON.stringify(payload))}.sig`;
}

function post(body: unknown) {
  return new Request("http://localhost/function", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function trackingReader(input: {
  role: string | null;
  courseFound?: boolean;
  enrolled?: boolean;
  lessons?: Array<{ title: string | null; content: string | null }>;
}) {
  const calls: string[] = [];
  const reader: StudyReader = {
    async userId() {
      calls.push("user");
      return { ok: true, userId: "user-1" };
    },
    async role() {
      calls.push("role");
      return { ok: true, role: input.role };
    },
    async course() {
      calls.push("course");
      if (!input.courseFound) return { ok: true, course: null };
      return { ok: true, course: { title: "Algebra", description: "Numbers" } };
    },
    async enrolled() {
      calls.push("enrolled");
      return { ok: true, enrolled: Boolean(input.enrolled) };
    },
    async lessons() {
      calls.push("lessons");
      return { ok: true, lessons: input.lessons ?? [] };
    },
  };
  return { reader, calls };
}

function studyDeps(
  reader: StudyReader,
  fetchImpl: typeof fetch,
  extra?: {
    publishableKey?: string;
    geminiKey?: string | undefined;
    authorization?: string | null;
  },
) {
  return {
    supabaseUrl: "http://localhost:54321",
    publishableKey: extra?.publishableKey ?? "sb_publishable_test",
    geminiKey: extra && "geminiKey" in extra ? extra.geminiKey : "AIzaSyTestKeyValue1234567890",
    authorization: extra && "authorization" in extra ? (extra.authorization ?? null) : bearer(),
    reader,
    fetchImpl,
  };
}

describe("AI security checks", () => {
  describe("role restrictions", () => {
    it("rejects an instructor or admin before reading a course for the study companion", async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      for (const role of ["instructor", "admin"]) {
        const tracked = trackingReader({ role, courseFound: true, enrolled: true });
        const response = await handleStudy(
          post({ courseId, question: "Explain this." }),
          studyDeps(tracked.reader, fetchImpl),
        );
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          message: "Only a student can use the study companion.",
        });
        expect(tracked.calls).toEqual(["user", "role"]);
        expect(fetchImpl).not.toHaveBeenCalled();
      }
    });

    it("rejects a student or admin before calling the model for the course builder", async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      for (const role of ["student", "admin"]) {
        const calls: string[] = [];
        const response = await handleCourseBuilder(
          post({ brief: "Teach plants.", level: "beginner" }),
          {
            supabaseUrl: "http://localhost:54321",
            publishableKey: "sb_publishable_test",
            geminiKey: "AIzaSyTestKeyValue1234567890",
            authorization: bearer(),
            fetchImpl,
            reader: {
              async userId() {
                calls.push("user");
                return { ok: true, userId: "user-1" };
              },
              async role() {
                calls.push("role");
                return { ok: true, role };
              },
            },
          },
        );
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          message: "Only an instructor can use the course builder.",
        });
        expect(calls).toEqual(["user", "role"]);
        expect(fetchImpl).not.toHaveBeenCalled();
      }
    });
  });

  describe("enrollment checks", () => {
    it("does not read lessons or call Gemini when the student is not enrolled", async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      const tracked = trackingReader({
        role: "student",
        courseFound: true,
        enrolled: false,
        lessons: [{ title: "Sums", content: "Add numbers" }],
      });
      const response = await handleStudy(
        post({ courseId, question: "Explain this." }),
        studyDeps(tracked.reader, fetchImpl),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        message: "This course is not available.",
      });
      expect(tracked.calls).toEqual(["user", "role", "course", "enrolled"]);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("uses the same not-available message when the course is hidden", async () => {
      const tracked = trackingReader({ role: "student", courseFound: false, enrolled: true });
      const response = await handleStudy(
        post({ courseId, question: "Explain this." }),
        studyDeps(tracked.reader, vi.fn<typeof fetch>()),
      );
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        message: "This course is not available.",
      });
      expect(tracked.calls).not.toContain("lessons");
    });

    it("does not call Gemini when the enrolled course has no lesson content", async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      const tracked = trackingReader({
        role: "student",
        courseFound: true,
        enrolled: true,
        lessons: [{ title: "Empty", content: "  " }],
      });
      const response = await handleStudy(
        post({ courseId, question: "Explain this." }),
        studyDeps(tracked.reader, fetchImpl),
      );
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        message: "This course has no lesson content yet.",
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe("RLS", () => {
    it("rejects a service-role key and does not query as that key", async () => {
      const serviceKey = jwt({ role: "service_role" });
      const resolved = resolveUserClient({
        supabaseUrl: "http://localhost:54321",
        publishableKey: serviceKey,
        authorization: bearer(),
      });
      expect(resolved.ok).toBe(false);
      if (!resolved.ok) {
        expect(resolved.message).toBe("AI is not configured.");
        expect(resolved.message).not.toContain(serviceKey);
      }

      const secretKey = resolveUserClient({
        supabaseUrl: "http://localhost:54321",
        publishableKey: "sb_secret_test",
        authorization: bearer(),
      });
      expect(secretKey.ok).toBe(false);

      const tracked = trackingReader({ role: "student", courseFound: true, enrolled: true });
      const response = await handleStudy(
        post({ courseId, question: "Explain this." }),
        studyDeps(tracked.reader, vi.fn<typeof fetch>(), { publishableKey: serviceKey }),
      );
      const text = await response.text();
      expect(text).toContain("AI is not configured.");
      expect(text).not.toContain(serviceKey);
      expect(tracked.calls).toEqual([]);
    });

    it("selects only the course, lesson, enrollment, and role columns the student may need", async () => {
      expect(studyCourseColumns).toBe("title, description");
      expect(studyLessonColumns).toBe("title, content");
      expect(
        `${studyCourseColumns} ${studyLessonColumns} ${studyEnrollmentColumns} ${studyRoleColumns}`,
      ).not.toMatch(/grade|feedback|content_url|\*/);

      const selects: string[] = [];
      const result = { data: null, error: null };
      const promise = Promise.resolve(result);
      const filter = {
        eq() {
          return filter;
        },
        maybeSingle: () => promise,
        then: promise.then.bind(promise),
      };
      const db: StudyDb = {
        auth: {
          async getUser() {
            return { data: { user: { id: "user-1" } }, error: null };
          },
        },
        from(table) {
          return {
            select(columns) {
              selects.push(`${table}:${columns}`);
              return { eq: () => filter };
            },
          };
        },
      };
      const reader = bindStudyReader(db, "token");
      await reader.userId();
      await reader.role("user-1");
      await reader.course(courseId);
      await reader.enrolled(courseId, "user-1");
      await reader.lessons(courseId);
      expect(selects).toEqual([
        "profiles:role",
        "courses:title, description",
        "enrollments:id",
        "lessons:title, content",
      ]);
    });

    it("sends only the enrolled course's lesson text to the model", async () => {
      let body = "";
      const fetchImpl: typeof fetch = async (_input, init) => {
        body = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        explanation: "Plants use light.",
                        example: "A leaf in the sun.",
                        practiceQuestions: ["What do leaves use?"],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      };
      const tracked = trackingReader({
        role: "student",
        courseFound: true,
        enrolled: true,
        lessons: [{ title: "Leaves", content: "photosynthesis" }],
      });
      const response = await handleStudy(
        post({ courseId, question: "How do leaves eat?" }),
        studyDeps(tracked.reader, fetchImpl),
      );
      expect(response.status).toBe(200);
      expect(body).toContain("photosynthesis");
      expect(body).not.toContain("secret-grade-99");
      expect(body).not.toContain("content_url");
    });
  });

  describe("secret handling", () => {
    it("does not echo the Gemini key when it is missing or the upstream request fails", async () => {
      const apiKey = "AIzaSyTestKeyValue1234567890";
      const tracked = trackingReader({
        role: "student",
        courseFound: true,
        enrolled: true,
        lessons: [{ title: "Sums", content: "Add numbers" }],
      });
      const missing = await handleStudy(
        post({ courseId, question: "Explain addition." }),
        studyDeps(tracked.reader, vi.fn<typeof fetch>(), { geminiKey: undefined }),
      );
      const missingText = await missing.text();
      expect(missingText).toContain("AI is not configured.");
      expect(missingText).not.toContain("sk-");

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const failed = await handleStudy(
        post({ courseId, question: "Explain addition." }),
        studyDeps(
          trackingReader({
            role: "student",
            courseFound: true,
            enrolled: true,
            lessons: [{ title: "Sums", content: "Add numbers" }],
          }).reader,
          async () => new Response(apiKey, { status: 500 }),
          { geminiKey: apiKey },
        ),
      );
      const failedText = await failed.text();
      expect(failedText).toContain("The AI request failed.");
      expect(failedText).not.toContain(apiKey);
      const logged = errorSpy.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
      expect(logged).toContain('"status":500');
      expect(logged).not.toContain(apiKey);
      expect(logged).not.toContain("Add numbers");
      errorSpy.mockRestore();
    });

    it("keeps the key out of browser modules and function entrypoints", () => {
      const studyIndex = readFileSync(
        resolve(root, "supabase/functions/ai-study/index.ts"),
        "utf8",
      );
      const builderIndex = readFileSync(
        resolve(root, "supabase/functions/ai-course-builder/index.ts"),
        "utf8",
      );
      const studyApi = readFileSync(
        resolve(root, "src/features/student/study-companion-api.ts"),
        "utf8",
      );
      const builderApi = readFileSync(
        resolve(root, "src/features/instructor/course-builder-api.ts"),
        "utf8",
      );

      expect(studyIndex).toContain("GEMINI_API_KEY");
      expect(studyIndex).not.toContain("OPENAI_API_KEY");
      expect(studyIndex).toContain("SUPABASE_ANON_KEY");
      expect(studyIndex).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(studyIndex).not.toContain("sk-");
      expect(builderIndex).toContain("GEMINI_API_KEY");
      expect(builderIndex).not.toContain("OPENAI_API_KEY");
      expect(builderIndex).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(builderIndex).not.toContain(".insert(");
      expect(builderIndex).not.toContain('.from("courses")');
      expect(builderIndex).not.toContain('.from("lessons")');
      expect(builderIndex).not.toContain('.from("submissions")');
      expect(studyApi).not.toContain("OPENAI");
      expect(studyApi).not.toContain("GEMINI");
      expect(studyApi).not.toContain("VITE_");
      expect(builderApi).not.toContain("OPENAI");
      expect(builderApi).not.toContain("GEMINI");
      expect(builderApi).not.toContain("VITE_");
      expect(sanitizePublicMessage(`failure sk-live-secret and ${"sb_secret_abc"}`)).toBe(
        "The AI request failed.",
      );
      expect(sanitizePublicMessage("key AIzaSyTestKeyValue1234567890")).toBe(
        "The AI request failed.",
      );
    });

    it("shows a function error message without forwarding a secret", async () => {
      const result = await readFunctionResult(null, {
        message: "Edge Function returned a non-2xx status code sk-live-secret",
        context: new Response(
          JSON.stringify({ message: "Only a student can use the study companion." }),
        ),
      });
      expect(result).toEqual({
        ok: false,
        message: "Only a student can use the study companion.",
      });
    });
  });

  describe("draft-only saving", () => {
    const validInput = {
      instructorId: "instructor-1",
      title: "  Plants  ",
      description: "  How plants grow.  ",
      level: "beginner",
      categoryId: "category-1",
      categoryIds: ["category-1"],
      lessons: [{ title: " Leaves ", content: " Leaves make food. " }],
      assignments: [{ title: " Quiz ", description: " Name a leaf. " }],
    };

    it("inserts a draft and does not insert when the edited preview is invalid", async () => {
      const courseRows: unknown[] = [];
      const writer = fakeWriter(courseRows);
      const saved = await startGeneratedSave(validInput, writer);
      expect(saved.ok).toBe(true);
      expect(courseRows).toEqual([
        {
          instructor_id: "instructor-1",
          title: "Plants",
          description: "How plants grow.",
          level: "beginner",
          category_id: "category-1",
          status: "draft",
        },
      ]);
      expect(writer.insertLesson).toHaveBeenCalledWith({
        course_id: "course-1",
        title: "Leaves",
        content: "Leaves make food.",
        video_url: null,
        order_index: 1,
      });
      expect(writer.insertAssignment).toHaveBeenCalledWith({
        course_id: "course-1",
        title: "Quiz",
        description: "Name a leaf.",
        due_date: null,
      });

      const rejected = fakeWriter();
      const invalid = await startGeneratedSave(
        { ...validInput, lessons: [{ title: "Leaves", content: "   " }] },
        rejected,
      );
      expect(invalid).toMatchObject({ ok: false, course: null, step: "validation" });
      expect(rejected.insertCourse).not.toHaveBeenCalled();
      expect(rejected.insertLesson).not.toHaveBeenCalled();
      expect(rejected.insertAssignment).not.toHaveBeenCalled();
    });

    it("rejects a blank title, a long description, and a blank assignment before inserting", async () => {
      const writer = fakeWriter();
      const blankTitle = await startGeneratedSave({ ...validInput, title: "   " }, writer);
      const longDescription = await startGeneratedSave(
        { ...validInput, description: "d".repeat(2001) },
        writer,
      );
      const blankAssignment = await startGeneratedSave(
        { ...validInput, assignments: [{ title: "Quiz", description: "  " }] },
        writer,
      );

      expect(blankTitle).toMatchObject({ ok: false, course: null, step: "validation" });
      expect(longDescription).toMatchObject({ ok: false, course: null, step: "validation" });
      expect(blankAssignment).toMatchObject({ ok: false, course: null, step: "validation" });
      expect(writer.insertCourse).not.toHaveBeenCalled();
    });

    it("returns the created course and stops when a later insert fails", async () => {
      const writer = fakeWriter();
      writer.insertLesson.mockResolvedValueOnce({ ok: false, message: "lesson insert failed" });
      const result = await startGeneratedSave(validInput, writer);
      expect(result).toEqual({
        ok: false,
        message: "lesson insert failed",
        course: { id: "course-1", title: "Plants" },
        step: "lessons",
      });
      expect(writer.insertAssignment).not.toHaveBeenCalled();

      const assignmentWriter = fakeWriter();
      assignmentWriter.insertAssignment.mockResolvedValueOnce({
        ok: false,
        message: "assignment insert failed",
      });
      const assignmentResult = await startGeneratedSave(validInput, assignmentWriter);
      expect(assignmentResult).toMatchObject({
        ok: false,
        message: "assignment insert failed",
        course: { id: "course-1", title: "Plants" },
        step: "assignments",
      });
    });

    it("drops status, due dates, and video URLs from the model preview", async () => {
      const fetchImpl: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        title: "Plants",
                        description: `${"d".repeat(2500)}`,
                        status: "published",
                        lessons: [
                          {
                            title: "Leaves",
                            content: "Leaves make food",
                            video_url: "https://example.invalid/secret",
                            status: "published",
                          },
                        ],
                        assignments: [
                          {
                            title: "Quiz",
                            description: "Name a leaf",
                            due_date: "2020-01-01T00:00:00.000Z",
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      const response = await handleCourseBuilder(
        post({ brief: "Teach plants.", level: "beginner" }),
        {
          supabaseUrl: "http://localhost:54321",
          publishableKey: "sb_publishable_test",
          geminiKey: "AIzaSyTestKeyValue1234567890",
          authorization: bearer(),
          fetchImpl,
          reader: {
            async userId() {
              return { ok: true, userId: "instructor-1" };
            },
            async role() {
              return { ok: true, role: "instructor" };
            },
          },
        },
      );
      const body = await response.json();
      expect(body.preview).toEqual({
        title: "Plants",
        description: "d".repeat(2000),
        lessons: [{ title: "Leaves", content: "Leaves make food" }],
        assignments: [{ title: "Quiz", description: "Name a leaf" }],
      });
      expect(JSON.stringify(body.preview)).not.toContain("published");
      expect(JSON.stringify(body.preview)).not.toContain("video_url");
      expect(JSON.stringify(body.preview)).not.toContain("2020-01-01");
    });
  });
});

function fakeWriter(courseRows: unknown[] = []): CourseWriter & {
  insertCourse: ReturnType<typeof vi.fn>;
  insertLesson: ReturnType<typeof vi.fn>;
  insertAssignment: ReturnType<typeof vi.fn>;
} {
  return {
    insertCourse: vi.fn(async (row: { title: string }) => {
      courseRows.push(row);
      return { ok: true as const, course: { id: "course-1", title: row.title } };
    }),
    insertLesson: vi.fn(async () => ({ ok: true as const })),
    insertAssignment: vi.fn(async () => ({ ok: true as const })),
  };
}
