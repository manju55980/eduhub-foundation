type Row = Record<string, unknown>;

type Filter = { column: string; op: "eq" | "in"; value: unknown };

const tableNames = [
  "courses",
  "lessons",
  "assignments",
  "enrollments",
  "submissions",
  "categories",
  "lesson_completions",
  "certificates",
  "notifications",
] as const;

type TableName = (typeof tableNames)[number];

export function createMemorySupabase() {
  const tables = emptyTables();
  let sequence = 0;

  function nextId(prefix: string) {
    sequence += 1;
    return `${prefix}-${sequence}`;
  }

  function rowsOf(table: string) {
    return tables[table as TableName] ?? [];
  }

  function matching(
    table: string,
    filters: Filter[],
    orderBy: { column: string; ascending: boolean } | null,
  ) {
    let rows = rowsOf(table).filter((row) => rowMatches(row, filters));
    if (orderBy) {
      const direction = orderBy.ascending ? 1 : -1;
      rows = [...rows].sort((left, right) => {
        const a = String(left[orderBy.column] ?? "");
        const b = String(right[orderBy.column] ?? "");
        return a.localeCompare(b) * direction;
      });
    }
    return rows.map((row) => ({ ...row }));
  }

  function insertRow(table: string, row: Row) {
    const stored = {
      ...row,
      id: typeof row.id === "string" ? row.id : nextId(table),
      created_at: typeof row.created_at === "string" ? row.created_at : "2026-10-18T12:00:00.000Z",
    };
    if (table === "lesson_completions") {
      const duplicate = rowsOf(table).some(
        (item) => item.student_id === stored.student_id && item.lesson_id === stored.lesson_id,
      );
      if (duplicate) return { error: { message: "This lesson is already complete." } };
    }
    if (table === "enrollments") {
      const duplicate = rowsOf(table).some(
        (item) => item.student_id === stored.student_id && item.course_id === stored.course_id,
      );
      if (duplicate) return { error: { message: "You are already enrolled in this course." } };
    }
    rowsOf(table).push(stored);
    if (table === "lesson_completions") issueCompletion(stored);
    return { error: null };
  }

  function issueCompletion(completion: Row) {
    const lesson = rowsOf("lessons").find((item) => item.id === completion.lesson_id);
    if (!lesson) return;
    const courseLessons = rowsOf("lessons").filter((item) => item.course_id === lesson.course_id);
    const done = rowsOf("lesson_completions").filter(
      (item) =>
        item.student_id === completion.student_id &&
        courseLessons.some((courseLesson) => courseLesson.id === item.lesson_id),
    );
    const enrollment = rowsOf("enrollments").find(
      (item) => item.student_id === completion.student_id && item.course_id === lesson.course_id,
    );
    if (!enrollment) return;
    const progress =
      courseLessons.length === 0 ? 0 : Math.floor((done.length * 100) / courseLessons.length);
    const previous = enrollment.status;
    enrollment.progress = progress;
    enrollment.status = progress === 100 ? "completed" : "active";
    if (previous === "completed" || enrollment.status !== "completed") return;
    const course = rowsOf("courses").find((item) => item.id === lesson.course_id);
    const title = typeof course?.title === "string" ? course.title : "";
    rowsOf("certificates").push({
      id: nextId("certificates"),
      enrollment_id: enrollment.id,
      student_id: enrollment.student_id,
      course_id: enrollment.course_id,
      issued_at: "2026-10-18T15:00:00.000Z",
      created_at: "2026-10-18T15:00:00.000Z",
    });
    rowsOf("notifications").push(
      {
        id: nextId("notifications"),
        recipient_id: enrollment.student_id,
        kind: "course_completed",
        course_id: enrollment.course_id,
        enrollment_id: enrollment.id,
        title: "Course complete",
        body: title,
        read_at: null,
        dedupe_key: `course_completed:${enrollment.id}`,
        created_at: "2026-10-18T15:00:00.000Z",
      },
      {
        id: nextId("notifications"),
        recipient_id: course?.instructor_id,
        kind: "student_completed_course",
        course_id: enrollment.course_id,
        enrollment_id: enrollment.id,
        title: "A student completed a course",
        body: title,
        read_at: null,
        dedupe_key: `student_completed_course:${enrollment.id}`,
        created_at: "2026-10-18T15:00:01.000Z",
      },
    );
  }

  function from(table: string) {
    const filters: Filter[] = [];
    let orderBy: { column: string; ascending: boolean } | null = null;
    let patch: Row | null = null;
    const api = {
      select() {
        return api;
      },
      eq(column: string, value: unknown) {
        filters.push({ column, op: "eq", value });
        return api;
      },
      in(column: string, value: unknown[]) {
        filters.push({ column, op: "in", value });
        return api;
      },
      order(column: string, options?: { ascending?: boolean }) {
        orderBy = { column, ascending: options?.ascending !== false };
        return api;
      },
      maybeSingle() {
        const rows = matching(table, filters, orderBy);
        if (rows.length > 1)
          return Promise.resolve({ data: null, error: { message: "multiple rows" } });
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      insert(row: Row) {
        return Promise.resolve(insertRow(table, row));
      },
      update(next: Row) {
        patch = next;
        return api;
      },
      then(
        onFulfilled: (value: { data: Row[] | null; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        if (patch) {
          for (const row of rowsOf(table)) {
            if (rowMatches(row, filters)) Object.assign(row, patch);
          }
          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
        }
        return Promise.resolve({ data: matching(table, filters, orderBy), error: null }).then(
          onFulfilled,
          onRejected,
        );
      },
    };
    return api;
  }

  return {
    supabase: { from },
    tables,
    reset() {
      for (const name of tableNames) tables[name] = [];
      sequence = 0;
    },
    seedStudentJourney() {
      this.reset();
      tables.categories.push({
        id: "category-e2e",
        name: "Mathematics",
        created_at: "2026-10-01T00:00:00.000Z",
      });
      tables.courses.push(
        {
          id: "course-e2e",
          instructor_id: "instructor-e2e",
          title: "Fractions studio",
          description: "Learn halves and quarters.",
          level: "beginner",
          status: "published",
          category_id: "category-e2e",
          created_at: "2026-10-10T00:00:00.000Z",
        },
        {
          id: "course-draft",
          instructor_id: "instructor-e2e",
          title: "Draft only",
          description: "Not in the catalogue.",
          level: "beginner",
          status: "draft",
          category_id: null,
          created_at: "2026-10-11T00:00:00.000Z",
        },
      );
      tables.lessons.push({
        id: "lesson-e2e",
        course_id: "course-e2e",
        title: "Halves",
        content: "Split one into two.",
        video_url: null,
        order_index: 1,
        created_at: "2026-10-10T01:00:00.000Z",
      });
      tables.assignments.push({
        id: "assignment-e2e",
        course_id: "course-e2e",
        title: "Practice sheet",
        description: "Add two halves.",
        due_date: "2026-10-20T12:00:00.000Z",
        created_at: "2026-10-10T02:00:00.000Z",
      });
    },
  };
}

function rowMatches(row: Row, filters: Filter[]) {
  return filters.every((filter) => {
    if (filter.op === "eq") return row[filter.column] === filter.value;
    return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
  });
}

export const studentJourneyMemory = createMemorySupabase();

function emptyTables(): Record<TableName, Row[]> {
  return {
    courses: [],
    lessons: [],
    assignments: [],
    enrollments: [],
    submissions: [],
    categories: [],
    lesson_completions: [],
    certificates: [],
    notifications: [],
  };
}
