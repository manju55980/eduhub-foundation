import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCalendarCourses, listCalendarEvents, saveClassSession } from "./calendar-api";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => from(...args) },
}));

type Filter = { method: string; column: string; value: unknown };

function query(data: unknown, error: { message: string } | null = null) {
  const filters: Filter[] = [];
  const builder = {
    filters,
    select: () => builder,
    lt(column: string, value: unknown) {
      filters.push({ method: "lt", column, value });
      return builder;
    },
    gt(column: string, value: unknown) {
      filters.push({ method: "gt", column, value });
      return builder;
    },
    gte(column: string, value: unknown) {
      filters.push({ method: "gte", column, value });
      return builder;
    },
    in(column: string, value: unknown) {
      filters.push({ method: "in", column, value });
      return builder;
    },
    order(column: string, value: unknown) {
      filters.push({ method: "order", column, value });
      return builder;
    },
    insert(value: unknown) {
      filters.push({ method: "insert", column: "", value });
      return builder;
    },
    update(value: unknown) {
      filters.push({ method: "update", column: "", value });
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.push({ method: "eq", column, value });
      return builder;
    },
    then(resolve: (result: { data: unknown; error: { message: string } | null }) => unknown) {
      return Promise.resolve({ data, error }).then(resolve);
    },
  };
  return builder;
}

const range = {
  start: new Date("2026-11-01T00:00:00.000Z"),
  end: new Date("2026-12-01T00:00:00.000Z"),
};

describe("listCalendarEvents", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("loads overlapping classes and deadlines inside the range", async () => {
    const sessions = query([
      {
        id: "session-1",
        course_id: "course-1",
        title: "Seminar",
        starts_at: "2026-11-11T04:00:00.000Z",
        ends_at: "2026-11-11T05:00:00.000Z",
        location: "Lab",
      },
    ]);
    const assignments = query([
      {
        id: "assignment-1",
        course_id: "course-1",
        title: "Essay",
        due_date: "2026-11-12T12:00:00.000Z",
      },
      {
        id: "assignment-2",
        course_id: "course-1",
        title: "Open",
        due_date: null,
      },
    ]);
    const courses = query([{ id: "course-1", title: "Algebra" }]);
    from
      .mockReturnValueOnce(sessions)
      .mockReturnValueOnce(assignments)
      .mockReturnValueOnce(courses);

    const result = await listCalendarEvents(range);

    expect(from).toHaveBeenNthCalledWith(1, "class_sessions");
    expect(from).toHaveBeenNthCalledWith(2, "assignments");
    expect(from).toHaveBeenNthCalledWith(3, "courses");
    expect(sessions.filters).toEqual([
      { method: "lt", column: "starts_at", value: range.end.toISOString() },
      { method: "gt", column: "ends_at", value: range.start.toISOString() },
    ]);
    expect(assignments.filters).toEqual([
      { method: "gte", column: "due_date", value: range.start.toISOString() },
      { method: "lt", column: "due_date", value: range.end.toISOString() },
    ]);
    expect(courses.filters).toEqual([{ method: "in", column: "id", value: ["course-1"] }]);
    expect(result).toMatchObject({
      ok: true,
      events: [
        { id: "session-1", kind: "class", courseTitle: "Algebra", location: "Lab" },
        { id: "assignment-1", kind: "deadline", title: "Essay" },
      ],
    });
  });

  it("stops when the class query fails and skips courses when nothing is scheduled", async () => {
    from.mockReturnValueOnce(query(null, { message: "Could not load classes." }));

    await expect(listCalendarEvents(range)).resolves.toEqual({
      ok: false,
      message: "Could not load classes.",
    });
    expect(from).toHaveBeenCalledTimes(1);

    from.mockReset();
    from.mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    await expect(listCalendarEvents(range)).resolves.toEqual({ ok: true, events: [] });
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe("class session writes", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("lists courses for the signed-in user and names a blank title", async () => {
    const courses = query([
      { id: "course-1", title: "  Algebra  " },
      { id: "course-2", title: "   " },
    ]);
    from.mockReturnValueOnce(courses);

    await expect(listCalendarCourses()).resolves.toEqual({
      ok: true,
      courses: [
        { id: "course-1", title: "Algebra" },
        { id: "course-2", title: "Untitled course" },
      ],
    });
    expect(from).toHaveBeenCalledWith("courses");
    expect(courses.filters).toEqual([
      { method: "order", column: "created_at", value: { ascending: false } },
    ]);
  });

  it("inserts a meeting and updates one without sending the course", async () => {
    const session = {
      courseId: "course-1",
      title: "Seminar",
      startsAt: "2026-11-11T04:00:00.000Z",
      endsAt: "2026-11-11T05:00:00.000Z",
      location: null,
    };
    const inserted = query(null);
    from.mockReturnValueOnce(inserted);

    await expect(saveClassSession(null, session)).resolves.toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("class_sessions");
    expect(inserted.filters).toEqual([
      {
        method: "insert",
        column: "",
        value: {
          course_id: "course-1",
          title: "Seminar",
          starts_at: session.startsAt,
          ends_at: session.endsAt,
          location: null,
        },
      },
    ]);

    from.mockReset();
    const updated = query(null, { message: "Could not save the class." });
    from.mockReturnValueOnce(updated);
    await expect(saveClassSession("session-1", session)).resolves.toEqual({
      ok: false,
      message: "Could not save the class.",
    });
    expect(updated.filters).toEqual([
      {
        method: "update",
        column: "",
        value: {
          title: "Seminar",
          starts_at: session.startsAt,
          ends_at: session.endsAt,
          location: null,
        },
      },
      { method: "eq", column: "id", value: "session-1" },
    ]);
  });
});
