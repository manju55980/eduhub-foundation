import { supabase } from "@/integrations/supabase/client";

import { calendarEvents, type CalendarRange } from "./calendar-model";
import { classSessionInsert, classSessionUpdate, type ClassSessionText } from "./session-draft";

export async function listCalendarEvents(range: CalendarRange) {
  const start = range.start.toISOString();
  const end = range.end.toISOString();

  const sessionsResult = await supabase
    .from("class_sessions")
    .select("id, course_id, title, starts_at, ends_at, location")
    .lt("starts_at", end)
    .gt("ends_at", start);
  if (sessionsResult.error) {
    return { ok: false as const, message: sessionsResult.error.message };
  }

  const assignmentsResult = await supabase
    .from("assignments")
    .select("id, course_id, title, due_date")
    .gte("due_date", start)
    .lt("due_date", end);
  if (assignmentsResult.error) {
    return { ok: false as const, message: assignmentsResult.error.message };
  }

  const sessions = sessionsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const courseIds = [
    ...new Set([
      ...sessions.map((session) => session.course_id),
      ...assignments.map((assignment) => assignment.course_id),
    ]),
  ];

  let courses: Array<{ id: string; title: string | null }> = [];
  if (courseIds.length > 0) {
    const coursesResult = await supabase.from("courses").select("id, title").in("id", courseIds);
    if (coursesResult.error) {
      return { ok: false as const, message: coursesResult.error.message };
    }
    courses = coursesResult.data ?? [];
  }

  return {
    ok: true as const,
    events: calendarEvents({
      sessions: sessions.map((session) => ({
        id: session.id,
        courseId: session.course_id,
        title: session.title,
        startsAt: session.starts_at,
        endsAt: session.ends_at,
        location: session.location,
      })),
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        courseId: assignment.course_id,
        title: assignment.title,
        dueDate: assignment.due_date,
      })),
      courses,
    }),
  };
}

export async function listCalendarCourses() {
  const result = await supabase
    .from("courses")
    .select("id, title")
    .order("created_at", { ascending: false });
  if (result.error) return { ok: false as const, message: result.error.message };
  return {
    ok: true as const,
    courses: (result.data ?? []).map((course) => ({
      id: course.id,
      title: course.title?.trim() ? course.title.trim() : "Untitled course",
    })),
  };
}

export async function saveClassSession(id: string | null, session: ClassSessionText) {
  const result = id
    ? await supabase.from("class_sessions").update(classSessionUpdate(session)).eq("id", id)
    : await supabase.from("class_sessions").insert(classSessionInsert(session));
  if (result.error) return { ok: false as const, message: result.error.message };
  return { ok: true as const };
}
