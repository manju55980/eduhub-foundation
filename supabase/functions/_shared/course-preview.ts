export const briefLimit = 2000;
export const descriptionLimit = 2000;
export const maxLessons = 6;
export const maxAssignments = 4;
export const instructorOnlyMessage = "Only an instructor can use the course builder.";

const levels = ["beginner", "intermediate", "advanced"] as const;

export type BuilderLevel = (typeof levels)[number];

export type CoursePreview = {
  title: string;
  description: string;
  lessons: Array<{ title: string; content: string }>;
  assignments: Array<{ title: string; description: string }>;
};

export function parseBuilderRequest(
  body: unknown,
): { ok: true; brief: string; level: BuilderLevel } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "The request was not valid." };
  }
  const brief = "brief" in body && typeof body.brief === "string" ? body.brief.trim() : "";
  const level = "level" in body && typeof body.level === "string" ? body.level : "";
  if (!brief) return { ok: false, message: "Enter a brief." };
  if (brief.length > briefLimit) {
    return { ok: false, message: "The brief must be 2,000 characters or fewer." };
  }
  if (!isBuilderLevel(level)) return { ok: false, message: "Choose a level." };
  return { ok: true, brief, level };
}

export function isBuilderLevel(value: string): value is BuilderLevel {
  return (levels as readonly string[]).includes(value);
}

export function builderAccess(role: string | null) {
  if (role !== "instructor") return { ok: false as const, message: instructorOnlyMessage };
  return { ok: true as const };
}

export function builderPrompt(brief: string, level: BuilderLevel) {
  return {
    system:
      'You draft a course for an instructor to review. Reply with JSON only: {"title": string, "description": string, "lessons": [{"title": string, "content": string}], "assignments": [{"title": string, "description": string}]}. Write at most 6 lessons and at most 4 assignments. Keep the description within 2000 characters. Do not include a status, owner, due date, or video URL.',
    user: `Level: ${level}\nBrief: ${brief}`,
  };
}

export function parseCoursePreview(
  value: unknown,
): { ok: true; preview: CoursePreview } | { ok: false; message: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, message: "The AI response was not valid." };
  }
  const title = textField(value, "title");
  const description = textField(value, "description").slice(0, descriptionLimit).trim();
  if (!title || !description) return { ok: false, message: "The AI response was not valid." };

  const lessons = arrayField(value, "lessons")
    .map((item) => ({
      title: textField(item, "title"),
      content: textField(item, "content"),
    }))
    .filter((item) => item.title && item.content)
    .slice(0, maxLessons);
  if (lessons.length === 0) return { ok: false, message: "The AI response was not valid." };

  const assignments = arrayField(value, "assignments")
    .map((item) => ({
      title: textField(item, "title"),
      description: textField(item, "description"),
    }))
    .filter((item) => item.title && item.description)
    .slice(0, maxAssignments);

  return { ok: true, preview: { title, description, lessons, assignments } };
}

function textField(value: unknown, key: string) {
  const field = fieldValue(value, key);
  return typeof field === "string" ? field.trim() : "";
}

function arrayField(value: unknown, key: string) {
  const field = fieldValue(value, key);
  return Array.isArray(field) ? field : [];
}

function fieldValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || !(key in value)) return undefined;
  return (value as Record<string, unknown>)[key];
}
