import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const calendarWeekStartsOn = 1 as const;

export type CalendarView = "month" | "week" | "day";
export type CalendarRole = "student" | "instructor";
export type CalendarEventKind = "class" | "deadline";

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  courseId: string;
  courseTitle: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
};

export type CalendarRange = { start: Date; end: Date };

const weekOptions = { weekStartsOn: calendarWeekStartsOn };

export function visibleRange(anchor: Date, view: CalendarView): CalendarRange {
  if (view === "day") {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1) };
  }
  if (view === "week") {
    const start = startOfWeek(anchor, weekOptions);
    return { start, end: addDays(start, 7) };
  }
  const monthStart = startOfMonth(anchor);
  const start = startOfWeek(monthStart, weekOptions);
  const lastWeek = startOfWeek(addDays(addMonths(monthStart, 1), -1), weekOptions);
  return { start, end: addDays(lastWeek, 7) };
}

export function daysInRange(range: CalendarRange) {
  const days: Date[] = [];
  for (let day = range.start; day < range.end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

export function periodLabel(anchor: Date, view: CalendarView) {
  const range = visibleRange(anchor, view);
  const last = addDays(range.end, -1);
  if (view === "month") return format(anchor, "MMMM yyyy");
  if (view === "day") return format(range.start, "EEEE d MMM yyyy");
  if (format(range.start, "MMM yyyy") === format(last, "MMM yyyy")) {
    return `${format(range.start, "d")}–${format(last, "d MMM yyyy")}`;
  }
  return `${format(range.start, "d MMM")} – ${format(last, "d MMM yyyy")}`;
}

export function shiftAnchor(anchor: Date, view: CalendarView, direction: -1 | 1) {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addWeeks(anchor, direction);
  return addMonths(anchor, direction);
}

type SessionInput = {
  id: string;
  courseId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
};

type AssignmentInput = {
  id: string;
  courseId: string;
  title: string | null;
  dueDate: string | null;
};

export function calendarEvents(input: {
  sessions: SessionInput[];
  assignments: AssignmentInput[];
  courses: Array<{ id: string; title: string | null }>;
}): CalendarEvent[] {
  const titles = new Map(input.courses.map((course) => [course.id, courseLabel(course.title)]));
  const classes: CalendarEvent[] = input.sessions.map((session) => ({
    id: session.id,
    kind: "class",
    title: textOr(session.title, "Class"),
    courseId: session.courseId,
    courseTitle: titles.get(session.courseId) ?? "Course",
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    location: blankToNull(session.location),
  }));
  const deadlines: CalendarEvent[] = input.assignments.flatMap((assignment) => {
    if (!assignment.dueDate) return [];
    return [
      {
        id: assignment.id,
        kind: "deadline" as const,
        title: textOr(assignment.title, "Assignment"),
        courseId: assignment.courseId,
        courseTitle: titles.get(assignment.courseId) ?? "Course",
        startsAt: assignment.dueDate,
        endsAt: null,
        location: null,
      },
    ];
  });
  return [...classes, ...deadlines].sort(compareEvents);
}

export function eventsOnDay(events: readonly CalendarEvent[], day: Date) {
  const start = startOfDay(day).getTime();
  const end = addDays(startOfDay(day), 1).getTime();
  return events.filter((event) => occursOnDay(event, start, end)).sort(compareEvents);
}

export function formatEventWhen(event: CalendarEvent) {
  const start = new Date(event.startsAt);
  if (event.kind === "deadline") return `Due ${format(start, "h:mm a")}`;
  if (!event.endsAt) return format(start, "h:mm a");
  return `${format(start, "h:mm a")} – ${format(new Date(event.endsAt), "h:mm a")}`;
}

export function dayButtonLabel(day: Date) {
  return format(day, "EEEE d MMMM yyyy");
}

function occursOnDay(event: CalendarEvent, start: number, end: number) {
  const eventStart = new Date(event.startsAt).getTime();
  if (event.kind === "deadline") return eventStart >= start && eventStart < end;
  const eventEnd = new Date(event.endsAt ?? event.startsAt).getTime();
  return eventStart < end && eventEnd > start;
}

function compareEvents(left: CalendarEvent, right: CalendarEvent) {
  return (
    left.startsAt.localeCompare(right.startsAt) ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  );
}

function courseLabel(title: string | null) {
  return textOr(title, "Course");
}

function textOr(value: string | null, fallback: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : fallback;
}

function blankToNull(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
