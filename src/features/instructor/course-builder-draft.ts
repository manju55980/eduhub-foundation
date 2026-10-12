import { courseDraft, isCourseLevel, type CourseLevel } from "@/features/instructor/course-draft";
import { assignmentDraft, type AssignmentText } from "@/features/instructor/assignment-draft";
import { lessonDraft, type LessonText } from "@/features/instructor/lesson-draft";
import {
  descriptionLimit,
  maxAssignments,
  maxLessons,
} from "../../../supabase/functions/_shared/course-preview.ts";

export type GeneratedDraft = {
  title: string;
  description: string;
  level: CourseLevel;
  categoryId: string | null;
  lessons: LessonText[];
  assignments: AssignmentText[];
};

export function validateGeneratedDraft(input: {
  title: string;
  description: string;
  level: string;
  categoryId: string;
  categoryIds: string[];
  lessons: Array<{ title: string; content: string }>;
  assignments: Array<{ title: string; description: string }>;
}): { ok: true; draft: GeneratedDraft } | { ok: false; message: string } {
  const messages: string[] = [];
  const course = courseDraft(input.title, input.description, input.level);
  if (!course.ok) messages.push(course.message);
  if (input.description.trim().length > descriptionLimit) {
    messages.push("The description must be 2,000 characters or fewer.");
  }

  const trimmedCategoryId = input.categoryId.trim();
  if (trimmedCategoryId && !input.categoryIds.includes(trimmedCategoryId)) {
    messages.push("Choose a category from the list.");
  }

  if (input.lessons.length === 0) messages.push("Add at least one lesson.");
  if (input.lessons.length > maxLessons) {
    messages.push("A generated course can have at most 6 lessons.");
  }
  if (input.assignments.length > maxAssignments) {
    messages.push("A generated course can have at most 4 assignments.");
  }

  const lessons: LessonText[] = [];
  input.lessons.forEach((lesson, index) => {
    const draft = lessonDraft(lesson.title, lesson.content, "");
    if (!draft.ok) messages.push(`Lesson ${index + 1}: ${draft.message}`);
    else lessons.push({ ...draft.lesson, videoUrl: null });
  });

  const assignments: AssignmentText[] = [];
  input.assignments.forEach((assignment, index) => {
    const draft = assignmentDraft(assignment.title, assignment.description, "");
    if (!draft.ok) messages.push(`Assignment ${index + 1}: ${draft.message}`);
    else assignments.push({ ...draft.assignment, dueDate: null });
  });

  if (!course.ok || !isCourseLevel(input.level) || messages.length > 0) {
    return { ok: false, message: messages.join(" ") || "Check the preview before saving." };
  }

  return {
    ok: true,
    draft: {
      title: course.title,
      description: course.description,
      level: course.level,
      categoryId: trimmedCategoryId ? trimmedCategoryId : null,
      lessons,
      assignments,
    },
  };
}
