import { courseDraft, type CourseLevel } from "./course-draft";

export function courseFieldUpdate(
  title: string,
  description: string,
  level: string,
  categoryId: string,
) {
  const draft = courseDraft(title, description, level);
  if (!draft.ok) return draft;
  const trimmedCategoryId = categoryId.trim();
  return {
    ok: true as const,
    changes: {
      title: draft.title,
      description: draft.description,
      level: draft.level,
      categoryId: trimmedCategoryId ? trimmedCategoryId : null,
    },
  };
}

export function courseFieldPayload(changes: {
  title: string;
  description: string;
  level: CourseLevel;
  categoryId: string | null;
}) {
  return {
    title: changes.title,
    description: changes.description,
    level: changes.level,
    category_id: changes.categoryId,
  };
}

export function canSubmitCourse(status: string, lessonCount: number) {
  return status === "draft" && lessonCount > 0;
}

export function pendingStatusUpdate() {
  return { status: "pending" as const };
}

export function compareCoursesNewestFirst(a: { createdAt: string }, b: { createdAt: string }) {
  if (a.createdAt < b.createdAt) return 1;
  if (a.createdAt > b.createdAt) return -1;
  return 0;
}
