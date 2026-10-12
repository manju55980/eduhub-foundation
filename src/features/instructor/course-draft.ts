export const courseLevels = ["beginner", "intermediate", "advanced"] as const;

export type CourseLevel = (typeof courseLevels)[number];

export type CourseDraft =
  | { ok: true; title: string; description: string; level: CourseLevel }
  | { ok: false; message: string };

export function isCourseLevel(value: string): value is CourseLevel {
  return (courseLevels as readonly string[]).includes(value);
}

export function courseDraft(title: string, description: string, level: string): CourseDraft {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const messages: string[] = [];

  if (!trimmedTitle) messages.push("Enter a course title.");
  if (!trimmedDescription) messages.push("Enter a course description.");
  if (!isCourseLevel(level)) {
    messages.push("Choose a level.");
    return { ok: false, message: messages.join(" ") };
  }
  if (messages.length > 0) return { ok: false, message: messages.join(" ") };

  return {
    ok: true,
    title: trimmedTitle,
    description: trimmedDescription,
    level,
  };
}

export function draftCourseInsert(input: {
  instructorId: string;
  title: string;
  description: string;
  level: CourseLevel;
  categoryId: string | null;
}) {
  return {
    instructor_id: input.instructorId,
    title: input.title,
    description: input.description,
    level: input.level,
    category_id: input.categoryId,
    status: "draft" as const,
  };
}
