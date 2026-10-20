export const briefLimit = 2000;
export const descriptionLimit = 2000;
export const lessonContentLimit = 8000;
export const preferenceLimit = 500;
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

export type BuilderRequest = {
  brief: string;
  level: BuilderLevel;
  lessonCount: number;
  assignmentCount: number;
  difficulty: string;
  goals: string;
  projects: string;
  resources: string;
};

export function parseBuilderRequest(
  body: unknown,
): ({ ok: true } & BuilderRequest) | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "The request was not valid." };
  }
  const brief = textField(body, "brief");
  const level = textField(body, "level");
  if (!brief) return { ok: false, message: "Enter a brief." };
  if (brief.length > briefLimit) {
    return { ok: false, message: "The brief must be 2,000 characters or fewer." };
  }
  if (!isBuilderLevel(level)) return { ok: false, message: "Choose a level." };

  const lessonCount = wholeCount(
    fieldValue(body, "lessonCount"),
    1,
    maxLessons,
    "Enter the number of lessons.",
    "Choose 1 to 6 lessons.",
  );
  if (!lessonCount.ok) return lessonCount;
  const assignmentCount = wholeCount(
    fieldValue(body, "assignmentCount"),
    0,
    maxAssignments,
    "Enter the number of assignments.",
    "Choose 0 to 4 assignments.",
  );
  if (!assignmentCount.ok) return assignmentCount;

  const difficulty = optionalText(body, "difficulty", 120, "Difficulty");
  if (!difficulty.ok) return difficulty;
  const goals = optionalText(body, "goals", preferenceLimit, "Learning goals");
  if (!goals.ok) return goals;
  const projects = optionalText(body, "projects", preferenceLimit, "Projects");
  if (!projects.ok) return projects;
  const resources = optionalText(body, "resources", preferenceLimit, "Resource preferences");
  if (!resources.ok) return resources;

  return {
    ok: true,
    brief,
    level,
    lessonCount: lessonCount.value,
    assignmentCount: assignmentCount.value,
    difficulty: difficulty.value,
    goals: goals.value,
    projects: projects.value,
    resources: resources.value,
  };
}

export function isBuilderLevel(value: string): value is BuilderLevel {
  return (levels as readonly string[]).includes(value);
}

export function builderAccess(role: string | null) {
  if (role !== "instructor") return { ok: false as const, message: instructorOnlyMessage };
  return { ok: true as const };
}

export function builderPrompt(request: BuilderRequest) {
  const assignments =
    request.assignmentCount === 0
      ? "Write no assignments."
      : `Write exactly ${request.assignmentCount} assignments. Each assignment is a practical exercise that uses the lessons before it.`;
  const notes = [
    request.difficulty ? `Difficulty note: ${request.difficulty}` : "",
    request.goals ? `Learning goals: ${request.goals}` : "",
    request.projects ? `Projects: ${request.projects}` : "",
    request.resources ? `Resource preferences: ${request.resources}` : "",
  ].filter(Boolean);
  return {
    system: [
      "You draft a course for an instructor to review. Reply with JSON only:",
      '{"title": string, "description": string, "lessons": [{"title": string, "content": string}], "assignments": [{"title": string, "description": string}]}.',
      `Write exactly ${request.lessonCount} lessons, in teaching order, each one building on the lesson before it.`,
      "Each lesson content must use these headings, in this order: Learning objectives, Explanation, Example, Practice, Further reading.",
      "Keep the description within 2000 characters. Keep each lesson content within 8000 characters.",
      assignments,
      "Do not include a status, owner, due date, or video URL. Do not invent video or document links.",
    ].join(" "),
    user: [`Level: ${request.level}`, `Brief: ${request.brief}`, ...notes].join("\n"),
  };
}

export function parseCoursePreview(
  value: unknown,
  expected: { lessons: number; assignments: number },
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
      content: textField(item, "content").slice(0, lessonContentLimit),
    }))
    .filter((item) => item.title && item.content);
  if (lessons.length < expected.lessons) {
    return { ok: false, message: "The AI response did not include every requested lesson." };
  }

  const assignments = arrayField(value, "assignments")
    .map((item) => ({
      title: textField(item, "title"),
      description: textField(item, "description"),
    }))
    .filter((item) => item.title && item.description);
  if (assignments.length < expected.assignments) {
    return { ok: false, message: "The AI response did not include every requested assignment." };
  }

  return {
    ok: true,
    preview: {
      title,
      description,
      lessons: lessons.slice(0, expected.lessons),
      assignments: assignments.slice(0, expected.assignments),
    },
  };
}

function wholeCount(
  value: unknown,
  min: number,
  max: number,
  emptyMessage: string,
  rangeMessage: string,
) {
  if (typeof value === "string" && !value.trim())
    return { ok: false as const, message: emptyMessage };
  const raw =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(raw)) return { ok: false as const, message: emptyMessage };
  if (raw < min || raw > max) return { ok: false as const, message: rangeMessage };
  return { ok: true as const, value: raw };
}

function optionalText(body: object, key: string, limit: number, label: string) {
  const value = textField(body, key);
  if (value.length > limit) {
    return { ok: false as const, message: `${label} must be ${limit} characters or fewer.` };
  }
  return { ok: true as const, value };
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
