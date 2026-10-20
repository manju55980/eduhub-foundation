import {
  runAssignmentReminders,
  type AssignmentRow,
  type EnrollmentReminderRow,
  type ReminderInsert,
  type ReminderStore,
  type SubmissionReminderRow,
} from "./assignment-reminders";

const pageSize = 1000;
const idChunk = 100;
const insertChunk = 200;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

type LooseFilter<T> = PromiseLike<PageResult<T>> & {
  eq(column: string, value: string): LooseFilter<T>;
  gt(column: string, value: string): LooseFilter<T>;
  lte(column: string, value: string): LooseFilter<T>;
  in(column: string, values: string[]): LooseFilter<T>;
  order(column: string): LooseFilter<T>;
  range(from: number, to: number): LooseFilter<T>;
};

type LooseClient = {
  from(table: string): {
    select(columns: string): LooseFilter<Record<string, unknown>>;
    upsert(
      rows: ReminderInsert[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<PageResult<unknown>>;
  };
};

export function supabaseReminderStore(client: LooseClient): ReminderStore {
  return {
    async loadAssignments(windowStart, windowEnd) {
      const rows = await readPages((from, to) =>
        client
          .from("assignments")
          .select("id, title, due_date, course_id")
          .gt("due_date", windowStart)
          .lte("due_date", windowEnd)
          .order("id")
          .range(from, to),
      );
      const courseIds = [...new Set(rows.map((row) => text(row, "course_id")))];
      const titles = new Map<string, string | null>();
      for (const course of await loadByIds(courseIds, (chunk, from, to) =>
        client.from("courses").select("id, title").in("id", chunk).order("id").range(from, to),
      )) {
        titles.set(text(course, "id"), nullableText(course, "title"));
      }
      return rows.map((row): AssignmentRow => ({
        id: text(row, "id"),
        title: nullableText(row, "title"),
        dueDate: nullableText(row, "due_date"),
        courseId: text(row, "course_id"),
        courseTitle: titles.get(text(row, "course_id")) ?? null,
      }));
    },
    async loadEnrollments(courseIds) {
      const rows = await loadByIds(courseIds, (chunk, from, to) =>
        client
          .from("enrollments")
          .select("id, student_id, course_id")
          .in("course_id", chunk)
          .order("id")
          .range(from, to),
      );
      return rows.map((row): EnrollmentReminderRow => ({
        id: text(row, "id"),
        studentId: text(row, "student_id"),
        courseId: text(row, "course_id"),
      }));
    },
    async loadSubmissions(assignmentIds) {
      const rows = await loadByIds(assignmentIds, (chunk, from, to) =>
        client
          .from("submissions")
          .select("assignment_id, student_id")
          .in("assignment_id", chunk)
          .order("assignment_id")
          .range(from, to),
      );
      return rows.map((row): SubmissionReminderRow => ({
        assignmentId: text(row, "assignment_id"),
        studentId: text(row, "student_id"),
      }));
    },
    async loadExistingKeys(keys) {
      const rows = await loadByIds(keys, (chunk, from, to) =>
        client
          .from("notifications")
          .select("dedupe_key")
          .in("dedupe_key", chunk)
          .order("dedupe_key")
          .range(from, to),
      );
      return rows.map((row) => text(row, "dedupe_key"));
    },
    async insertReminders(rows) {
      for (let index = 0; index < rows.length; index += insertChunk) {
        const result = await client
          .from("notifications")
          .upsert(rows.slice(index, index + insertChunk), {
            onConflict: "dedupe_key",
            ignoreDuplicates: true,
          });
        if (result.error) throw new Error(result.error.message);
      }
    },
  };
}

export async function runAssignmentReminderJob(now: Date) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return runAssignmentReminders(
    supabaseReminderStore(supabaseAdmin as unknown as LooseClient),
    now,
  );
}

async function loadByIds<T>(
  ids: string[],
  loadChunkPage: (chunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
) {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += idChunk) {
    const chunk = ids.slice(index, index + idChunk);
    rows.push(...(await readPages((from, to) => loadChunkPage(chunk, from, to))));
  }
  return rows;
}

async function readPages<T>(load: (from: number, to: number) => PromiseLike<PageResult<T>>) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await load(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableText(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}
