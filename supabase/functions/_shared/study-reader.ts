import {
  studyCourseColumns,
  studyEnrollmentColumns,
  studyLessonColumns,
  studyRoleColumns,
} from "./study-query.ts";
import type { StudyLesson } from "./study.ts";

type QueryError = { message: string } | null;

type QueryResult = {
  data: unknown;
  error: QueryError;
};

export type StudyDb = {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string } | null };
      error: QueryError;
    }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => StudyFilter;
    };
  };
};

type StudyFilter = PromiseLike<QueryResult> & {
  eq: (column: string, value: string) => StudyFilter;
  maybeSingle: () => Promise<QueryResult>;
};

export type StudyReader = {
  userId: () => Promise<{ ok: true; userId: string } | { ok: false; message: string }>;
  role: (
    userId: string,
  ) => Promise<{ ok: true; role: string | null } | { ok: false; message: string }>;
  course: (
    courseId: string,
  ) => Promise<
    | { ok: true; course: { title: string | null; description: string | null } | null }
    | { ok: false; message: string }
  >;
  enrolled: (
    courseId: string,
    userId: string,
  ) => Promise<{ ok: true; enrolled: boolean } | { ok: false; message: string }>;
  lessons: (
    courseId: string,
  ) => Promise<{ ok: true; lessons: StudyLesson[] } | { ok: false; message: string }>;
};

export function bindStudyReader(db: StudyDb, token: string): StudyReader {
  return {
    async userId() {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return { ok: false, message: "You need to be signed in." };
      return { ok: true, userId: data.user.id };
    },
    async role(userId) {
      const { data, error } = await db
        .from("profiles")
        .select(studyRoleColumns)
        .eq("id", userId)
        .maybeSingle();
      if (error) return { ok: false, message: error.message };
      const role = rowText(data, "role");
      return { ok: true, role };
    },
    async course(courseId) {
      const { data, error } = await db
        .from("courses")
        .select(studyCourseColumns)
        .eq("id", courseId)
        .maybeSingle();
      if (error) return { ok: false, message: error.message };
      if (!data || typeof data !== "object") return { ok: true, course: null };
      return {
        ok: true,
        course: {
          title: rowText(data, "title"),
          description: rowText(data, "description"),
        },
      };
    },
    async enrolled(courseId, userId) {
      const { data, error } = await db
        .from("enrollments")
        .select(studyEnrollmentColumns)
        .eq("course_id", courseId)
        .eq("student_id", userId)
        .maybeSingle();
      if (error) return { ok: false, message: error.message };
      return { ok: true, enrolled: Boolean(data) };
    },
    async lessons(courseId) {
      const { data, error } = await db
        .from("lessons")
        .select(studyLessonColumns)
        .eq("course_id", courseId);
      if (error) return { ok: false, message: error.message };
      const rows = Array.isArray(data) ? data : [];
      return {
        ok: true,
        lessons: rows.filter(isRecord).map((row) => ({
          title: rowText(row, "title"),
          content: rowText(row, "content"),
        })),
      };
    },
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
