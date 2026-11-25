import { tutorMatchCount, type TutorChunk, type TutorLesson } from "./course-tutor.ts";
import { knowledgeReadMessage } from "./embeddings.ts";
import { failedAiMessage } from "./gemini.ts";
import { fuseChunks, hybridCandidateLimit } from "./hybrid-search.ts";

type QueryError = { message: string } | null;
type QueryResult = { data: unknown; error: QueryError };

type TutorFilter = PromiseLike<QueryResult> & {
  eq: (column: string, value: string) => TutorFilter;
  maybeSingle: () => Promise<QueryResult>;
};

export type TutorDb = {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string } | null };
      error: QueryError;
    }>;
  };
  from: (table: string) => {
    select: (columns: string) => TutorFilter;
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<QueryResult>;
};

export type TutorReader = {
  userId: () => Promise<{ ok: true; userId: string } | { ok: false; message: string }>;
  role: (
    userId: string,
  ) => Promise<{ ok: true; role: string | null } | { ok: false; message: string }>;
  course: (
    courseId: string,
  ) => Promise<
    { ok: true; course: { title: string | null } | null } | { ok: false; message: string }
  >;
  enrolled: (
    courseId: string,
    userId: string,
  ) => Promise<{ ok: true; enrolled: boolean } | { ok: false; message: string }>;
  lessons: (
    courseId: string,
  ) => Promise<{ ok: true; lessons: TutorLesson[] } | { ok: false; message: string }>;
  matchKnowledge: (
    queryEmbedding: string,
  ) => Promise<{ ok: true; matches: TutorChunk[] } | { ok: false; message: string }>;
  retrieveHybrid?: (
    queryEmbedding: string,
    queryText: string,
  ) => Promise<{ ok: true; matches: TutorChunk[] } | { ok: false; message: string }>;
};

export function bindTutorReader(db: TutorDb, token: string): TutorReader {
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
    async course(courseId) {
      const { data, error } = await db
        .from("courses")
        .select("title")
        .eq("id", courseId)
        .maybeSingle();
      if (error) return { ok: false, message: failedAiMessage };
      if (!isRecord(data)) return { ok: true, course: null };
      return { ok: true, course: { title: rowText(data, "title") } };
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
        .select("id, title, order_index")
        .eq("course_id", courseId);
      if (error) return { ok: false, message: failedAiMessage };
      const rows = Array.isArray(data) ? data.filter(isRecord) : [];
      const lessons = rows.flatMap((row) => {
        const id = rowText(row, "id");
        if (!id) return [];
        return [{ id, title: rowText(row, "title"), orderIndex: rowNumber(row, "order_index") }];
      });
      lessons.sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
      return { ok: true, lessons };
    },
    async matchKnowledge(queryEmbedding) {
      const { data, error } = await db.rpc("match_knowledge", {
        query_embedding: queryEmbedding,
        match_count: tutorMatchCount,
      });
      if (error) return { ok: false, message: knowledgeReadMessage };
      const rows = Array.isArray(data) ? data.filter(isRecord) : [];
      return { ok: true, matches: rows.map(matchRow) };
    },
    async retrieveHybrid(queryEmbedding, queryText) {
      const vector = await db.rpc("match_knowledge", {
        query_embedding: queryEmbedding,
        match_count: hybridCandidateLimit,
      });
      if (vector.error) return { ok: false, message: knowledgeReadMessage };
      const text = await db.rpc("search_knowledge_text", {
        query_text: queryText,
        match_count: hybridCandidateLimit,
      });
      const vectorRows = Array.isArray(vector.data)
        ? vector.data.filter(isRecord).map(matchRow)
        : [];
      const textRows =
        text.error || !Array.isArray(text.data) ? [] : text.data.filter(isRecord).map(matchRow);
      return { ok: true, matches: fuseChunks(vectorRows, textRows, queryText) };
    },
  };
}

function matchRow(row: Record<string, unknown>): TutorChunk {
  const similarity = row["similarity"];
  return {
    id: rowText(row, "id") ?? "",
    sourceType: rowText(row, "source_type"),
    title: rowText(row, "title"),
    body: rowText(row, "body"),
    courseId: rowText(row, "course_id"),
    similarity: typeof similarity === "number" ? similarity : null,
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

function rowNumber(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
