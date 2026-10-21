import {
  agentEnrollmentInsert,
  catalogueCountErrorMessage,
  type SuggestCourse,
  type SuggestEnrollment,
} from "./agent.ts";
import type { AgentCourseDetail, AgentGrade, AgentMatch, AgentReader } from "./agent-tools.ts";
import { failedAiMessage } from "./gemini.ts";
import { notAvailableMessage } from "./study.ts";

type QueryError = { message: string; code?: string } | null;
type QueryResult = { data: unknown; error: QueryError; count?: number | null };

type AgentFilter = PromiseLike<QueryResult> & {
  eq: (column: string, value: string) => AgentFilter;
  in: (column: string, values: string[]) => AgentFilter;
  order: (column: string, options: { ascending: boolean }) => AgentFilter;
  limit: (count: number) => AgentFilter;
  maybeSingle: () => Promise<QueryResult>;
};

export type AgentDb = {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string } | null };
      error: QueryError;
    }>;
  };
  from: (table: string) => {
    select: (
      columns: string,
      options?: { count?: "exact"; head?: boolean },
    ) => AgentFilter;
    insert: (row: Record<string, unknown>) => Promise<QueryResult>;
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<QueryResult>;
};

export const gradeLimit = 20;

export function bindAgentReader(db: AgentDb, token: string): AgentReader {
  return {
    async userId() {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return { ok: false, message: "You need to be signed in." };
      return { ok: true, userId: data.user.id };
    },
    async role(userId) {
      const { data, error } = await db
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (error) return { ok: false, message: failedAiMessage };
      return { ok: true, role: rowText(data, "role") };
    },
    async matchKnowledge(queryEmbedding) {
      const { data, error } = await db.rpc("match_knowledge", {
        query_embedding: queryEmbedding,
        match_count: 5,
      });
      if (error) return { ok: false, message: failedAiMessage };
      const rows = Array.isArray(data) ? data : [];
      return { ok: true, matches: rows.filter(isRecord).map(matchRow) };
    },
    async course(courseId) {
      const { data, error } = await db
        .from("courses")
        .select("id, title, description, level, status, category_id, created_at")
        .eq("id", courseId)
        .maybeSingle();
      if (error) return { ok: false, message: failedAiMessage };
      if (!isRecord(data) || typeof data.id !== "string") return { ok: true, course: null };
      return { ok: true, course: courseDetail(data) };
    },
    async enrolled(courseId, userId) {
      const { data, error } = await db
        .from("enrollments")
        .select("id")
        .eq("course_id", courseId)
        .eq("student_id", userId)
        .maybeSingle();
      if (error) return { ok: false, message: failedAiMessage };
      return { ok: true, enrolled: Boolean(data) };
    },
    async lessons(courseId) {
      const { data, error } = await db
        .from("lessons")
        .select("title, content")
        .eq("course_id", courseId);
      if (error) return { ok: false, message: failedAiMessage };
      const rows = Array.isArray(data) ? data : [];
      return {
        ok: true,
        lessons: rows.filter(isRecord).map((row) => ({
          title: rowText(row, "title"),
          content: rowText(row, "content"),
        })),
      };
    },
    async enrol(userId, courseId) {
      const existing = await db
        .from("enrollments")
        .select("id")
        .eq("course_id", courseId)
        .eq("student_id", userId)
        .maybeSingle();
      if (existing.error) return { ok: false, message: failedAiMessage };

      const course = await db
        .from("courses")
        .select("id, title, status")
        .eq("id", courseId)
        .maybeSingle();
      if (course.error) return { ok: false, message: failedAiMessage };
      if (!isRecord(course.data)) return { ok: false, message: notAvailableMessage };
      const title = rowText(course.data, "title") || "Untitled course";
      if (existing.data) return { ok: true, title, courseId, already: true };
      if (rowText(course.data, "status") !== "published") {
        return { ok: false, message: notAvailableMessage };
      }

      const inserted = await db.from("enrollments").insert(agentEnrollmentInsert(userId, courseId));
      if (inserted.error?.code === "23505") return { ok: true, title, courseId, already: true };
      if (inserted.error) return { ok: false, message: failedAiMessage };
      return { ok: true, title, courseId, already: false };
    },
    async grades(userId) {
      const submissions = await db
        .from("submissions")
        .select("assignment_id, grade, feedback, status, created_at")
        .eq("student_id", userId)
        .eq("status", "graded")
        .order("created_at", { ascending: false })
        .limit(gradeLimit);
      if (submissions.error) return { ok: false, message: failedAiMessage };
      const rows = Array.isArray(submissions.data) ? submissions.data.filter(isRecord) : [];
      const assignmentIds = rows
        .map((row) => rowText(row, "assignment_id"))
        .filter((id): id is string => Boolean(id));
      const assignments = assignmentIds.length
        ? await db.from("assignments").select("id, title, course_id").in("id", assignmentIds)
        : { data: [], error: null };
      if (assignments.error) return { ok: false, message: failedAiMessage };
      const assignmentRows = Array.isArray(assignments.data)
        ? assignments.data.filter(isRecord)
        : [];
      const courseIds = assignmentRows
        .map((row) => rowText(row, "course_id"))
        .filter((id): id is string => Boolean(id));
      const courses = courseIds.length
        ? await db.from("courses").select("id, title").in("id", courseIds)
        : { data: [], error: null };
      if (courses.error) return { ok: false, message: failedAiMessage };
      const courseRows = Array.isArray(courses.data) ? courses.data.filter(isRecord) : [];
      return { ok: true, grades: gradeRows(rows, assignmentRows, courseRows) };
    },
    async catalogue(userId) {
      const enrollments = await db
        .from("enrollments")
        .select("course_id, status")
        .eq("student_id", userId);
      if (enrollments.error) return { ok: false, message: failedAiMessage };
      const enrollmentRows = Array.isArray(enrollments.data)
        ? enrollments.data.filter(isRecord)
        : [];
      const enrolledIds = enrollmentRows
        .map((row) => rowText(row, "course_id"))
        .filter((id): id is string => Boolean(id));
      const enrolledCourses = enrolledIds.length
        ? await db.from("courses").select("id, level, category_id").in("id", enrolledIds)
        : { data: [], error: null };
      if (enrolledCourses.error) return { ok: false, message: failedAiMessage };
      const published = await db
        .from("courses")
        .select("id, title, level, category_id, status, created_at")
        .eq("status", "published");
      if (published.error) return { ok: false, message: failedAiMessage };
      const enrolledDetails = Array.isArray(enrolledCourses.data)
        ? enrolledCourses.data.filter(isRecord)
        : [];
      const publishedRows = Array.isArray(published.data) ? published.data.filter(isRecord) : [];
      return {
        ok: true,
        enrollments: enrollmentRows.map((row) => enrollmentDetail(row, enrolledDetails)),
        published: publishedRows
          .map(publishedCourse)
          .filter((course): course is SuggestCourse => Boolean(course)),
      };
    },
    async publishedCount() {
      const counted = await db
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("status", "published");
      if (counted.error || typeof counted.count !== "number" || counted.count < 0) {
        return { ok: false, message: catalogueCountErrorMessage };
      }
      return { ok: true, count: counted.count };
    },
  };
}

function matchRow(row: Record<string, unknown>): AgentMatch {
  const similarity = row.similarity;
  return {
    id: typeof row.id === "string" ? row.id : "",
    sourceType: rowText(row, "source_type"),
    title: rowText(row, "title"),
    body: rowText(row, "body"),
    courseId: rowText(row, "course_id"),
    similarity: typeof similarity === "number" ? similarity : null,
  };
}

function courseDetail(row: Record<string, unknown>): AgentCourseDetail {
  return {
    id: String(row.id),
    title: rowText(row, "title"),
    description: rowText(row, "description"),
    level: rowText(row, "level"),
    status: rowText(row, "status"),
    categoryId: rowText(row, "category_id"),
    createdAt: rowText(row, "created_at") ?? "",
  };
}

function gradeRows(
  submissions: Record<string, unknown>[],
  assignments: Record<string, unknown>[],
  courses: Record<string, unknown>[],
): AgentGrade[] {
  const assignmentById = new Map(assignments.map((row) => [rowText(row, "id"), row]));
  const courseTitleById = new Map(
    courses.map((row) => [rowText(row, "id"), rowText(row, "title")]),
  );
  return submissions.map((submission) => {
    const assignment = assignmentById.get(rowText(submission, "assignment_id"));
    const courseId = assignment ? rowText(assignment, "course_id") : null;
    return {
      assignmentTitle: assignment ? rowText(assignment, "title") : null,
      courseTitle: courseId ? (courseTitleById.get(courseId) ?? null) : null,
      grade: rowText(submission, "grade"),
      feedback: rowText(submission, "feedback"),
    };
  });
}

function enrollmentDetail(
  row: Record<string, unknown>,
  courses: Record<string, unknown>[],
): SuggestEnrollment {
  const courseId = rowText(row, "course_id") ?? "";
  const course = courses.find((item) => rowText(item, "id") === courseId);
  return {
    courseId,
    status: rowText(row, "status") ?? "",
    level: course ? rowText(course, "level") : null,
    categoryId: course ? rowText(course, "category_id") : null,
  };
}

function publishedCourse(row: Record<string, unknown>): SuggestCourse | null {
  const id = rowText(row, "id");
  if (!id || rowText(row, "status") !== "published") return null;
  return {
    id,
    title: rowText(row, "title"),
    level: rowText(row, "level"),
    categoryId: rowText(row, "category_id"),
    createdAt: rowText(row, "created_at") ?? "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function rowText(row: unknown, key: string) {
  if (!isRecord(row) || !(key in row)) return null;
  const value = row[key];
  return typeof value === "string" ? value : null;
}
