import {
  reviewAssignmentColumns,
  reviewCourseColumns,
  reviewInsertColumns,
  reviewLessonColumns,
  reviewMaterialColumns,
  reviewRoleColumns,
} from "./review-query.ts";
import {
  reviewSaveMessage,
  sortReviewLessons,
  type ReviewAssignment,
  type ReviewCourse,
  type ReviewLesson,
  type ReviewMaterial,
  type ReviewRecommendation,
  type StoredReview,
} from "./course-review.ts";
import { isLowConfidence } from "./guardrails.ts";

type QueryError = { message: string } | null;

type QueryResult = {
  data: unknown;
  error: QueryError;
};

export type ReviewInsert = {
  course_id: string;
  recommendation: ReviewRecommendation;
  confidence: number;
  summary: string;
  findings: string[];
};

export type ReviewDb = {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string } | null };
      error: QueryError;
    }>;
  };
  from: (table: string) => {
    select: (columns: string) => ReviewFilter;
    insert: (row: ReviewInsert) => {
      select: (columns: string) => {
        single: () => Promise<QueryResult>;
      };
    };
  };
};

type ReviewFilter = PromiseLike<QueryResult> & {
  eq: (column: string, value: string) => ReviewFilter;
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => ReviewFilter;
  maybeSingle: () => Promise<QueryResult>;
};

export type ReviewReader = {
  userId: () => Promise<{ ok: true; userId: string } | { ok: false; message: string }>;
  role: (
    userId: string,
  ) => Promise<{ ok: true; role: string | null } | { ok: false; message: string }>;
  course: (
    courseId: string,
  ) => Promise<{ ok: true; course: ReviewCourse | null } | { ok: false; message: string }>;
  lessons: (
    courseId: string,
  ) => Promise<{ ok: true; lessons: ReviewLesson[] } | { ok: false; message: string }>;
  assignments: (
    courseId: string,
  ) => Promise<{ ok: true; assignments: ReviewAssignment[] } | { ok: false; message: string }>;
  materials: (
    courseId: string,
  ) => Promise<{ ok: true; materials: ReviewMaterial[] } | { ok: false; message: string }>;
  insertReview: (
    row: ReviewInsert,
  ) => Promise<{ ok: true; review: StoredReview } | { ok: false; message: string }>;
};

export function bindReviewReader(db: ReviewDb, token: string): ReviewReader {
  return {
    async userId() {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return { ok: false, message: "You need to be signed in." };
      return { ok: true, userId: data.user.id };
    },
    async role(userId) {
      const { data, error } = await db
        .from("profiles")
        .select(reviewRoleColumns)
        .eq("id", userId)
        .maybeSingle();
      if (error) return { ok: false, message: error.message };
      return { ok: true, role: rowText(data, "role") };
    },
    async course(courseId) {
      const { data, error } = await db
        .from("courses")
        .select(reviewCourseColumns)
        .eq("id", courseId)
        .maybeSingle();
      if (error) return { ok: false, message: error.message };
      if (!isRecord(data)) return { ok: true, course: null };
      const status = rowText(data, "status");
      const level = rowText(data, "level");
      if (!status || !level) return { ok: true, course: null };
      return {
        ok: true,
        course: {
          title: rowText(data, "title"),
          description: rowText(data, "description"),
          level,
          status,
        },
      };
    },
    async lessons(courseId) {
      const { data, error } = await db
        .from("lessons")
        .select(reviewLessonColumns)
        .eq("course_id", courseId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) return { ok: false, message: error.message };
      const lessons = (Array.isArray(data) ? data : []).filter(isRecord).flatMap((row) => {
        const createdAt = rowText(row, "created_at");
        if (!createdAt) return [];
        return [
          {
            title: rowText(row, "title"),
            content: rowText(row, "content"),
            orderIndex: rowNumber(row, "order_index"),
            createdAt,
          },
        ];
      });
      return { ok: true, lessons: sortReviewLessons(lessons) };
    },
    async assignments(courseId) {
      const { data, error } = await db
        .from("assignments")
        .select(reviewAssignmentColumns)
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });
      if (error) return { ok: false, message: error.message };
      const assignments = (Array.isArray(data) ? data : []).filter(isRecord).map((row) => ({
        title: rowText(row, "title"),
        description: rowText(row, "description"),
        dueDate: rowText(row, "due_date"),
      }));
      return { ok: true, assignments };
    },
    async materials(courseId) {
      const { data, error } = await db
        .from("course_materials")
        .select(reviewMaterialColumns)
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });
      if (error) return { ok: false, message: error.message };
      const materials = (Array.isArray(data) ? data : []).filter(isRecord).flatMap((row) => {
        const fileName = rowText(row, "file_name");
        const mimeType = rowText(row, "mime_type");
        if (!fileName || !mimeType) return [];
        return [{ fileName, mimeType }];
      });
      return { ok: true, materials };
    },
    async insertReview(row) {
      const { data, error } = await db
        .from("course_reviews")
        .insert(row)
        .select(reviewInsertColumns)
        .single();
      if (error || !isRecord(data))
        return { ok: false, message: error?.message ?? reviewSaveMessage };
      const recommendation = rowText(data, "recommendation");
      const summary = rowText(data, "summary");
      const confidence = rowNumber(data, "confidence");
      const findings = stringList(data["findings"]);
      if (
        (recommendation !== "recommend" && recommendation !== "revise") ||
        confidence == null ||
        summary == null
      ) {
        return { ok: false, message: reviewSaveMessage };
      }
      return {
        ok: true,
        review: {
          recommendation,
          confidence,
          lowConfidence: isLowConfidence(confidence),
          summary,
          findings,
        },
      };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rowText(row: unknown, key: string) {
  if (!isRecord(row) || !(key in row)) return null;
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function rowNumber(row: unknown, key: string) {
  if (!isRecord(row) || !(key in row)) return null;
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
