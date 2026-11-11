import { toDateTimeLocal } from "@/features/instructor/assignment-draft";

export type ClassSessionText = {
  courseId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
};

export function classSessionDraft(input: {
  courseId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
}): { ok: true; session: ClassSessionText } | { ok: false; message: string } {
  const messages: string[] = [];
  const courseId = input.courseId.trim();
  const title = input.title.trim();
  const location = input.location.trim();

  if (!courseId) messages.push("Choose a course.");
  if (!title) messages.push("Enter a class title.");

  const startsAt = parsedTime(input.startsAt, "start", messages);
  const endsAt = parsedTime(input.endsAt, "end", messages);
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    messages.push("End time must be after the start time.");
  }
  if (messages.length > 0 || !startsAt || !endsAt) {
    return { ok: false, message: messages.join(" ") };
  }

  return {
    ok: true,
    session: {
      courseId,
      title,
      startsAt,
      endsAt,
      location: location.length > 0 ? location : null,
    },
  };
}

export function classSessionInsert(session: ClassSessionText) {
  return {
    course_id: session.courseId,
    title: session.title,
    starts_at: session.startsAt,
    ends_at: session.endsAt,
    location: session.location,
  };
}

export function classSessionUpdate(session: ClassSessionText) {
  return {
    title: session.title,
    starts_at: session.startsAt,
    ends_at: session.endsAt,
    location: session.location,
  };
}

export function meetingWindow(day: Date) {
  const start = new Date(day);
  start.setHours(9, 0, 0, 0);
  const end = new Date(day);
  end.setHours(10, 0, 0, 0);
  return {
    startsAt: toDateTimeLocal(start.toISOString()),
    endsAt: toDateTimeLocal(end.toISOString()),
  };
}

function parsedTime(value: string, label: "start" | "end", messages: string[]) {
  const trimmed = value.trim();
  if (!trimmed) {
    messages.push(label === "start" ? "Enter a start time." : "Enter an end time.");
    return "";
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    messages.push(label === "start" ? "Enter a valid start time." : "Enter a valid end time.");
    return "";
  }
  return parsed.toISOString();
}
