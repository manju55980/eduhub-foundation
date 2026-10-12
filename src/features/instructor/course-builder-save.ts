import { assignmentInsert } from "@/features/instructor/assignment-draft";
import { draftCourseInsert } from "@/features/instructor/course-draft";
import { lessonInsert } from "@/features/instructor/lesson-draft";

import { validateGeneratedDraft, type GeneratedDraft } from "./course-builder-draft";

export type CreatedCourse = {
  id: string;
  title: string;
};

export type SaveGeneratedResult =
  | { ok: true; course: CreatedCourse }
  | {
      ok: false;
      message: string;
      course: CreatedCourse | null;
      step: "validation" | "course" | "lessons" | "assignments";
    };

export type CourseWriter = {
  insertCourse: (
    row: ReturnType<typeof draftCourseInsert>,
  ) => Promise<{ ok: true; course: CreatedCourse } | { ok: false; message: string }>;
  insertLesson: (
    row: ReturnType<typeof lessonInsert>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  insertAssignment: (
    row: ReturnType<typeof assignmentInsert>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export async function startGeneratedSave(
  input: {
    instructorId: string;
    title: string;
    description: string;
    level: string;
    categoryId: string;
    categoryIds: string[];
    lessons: Array<{ title: string; content: string }>;
    assignments: Array<{ title: string; description: string }>;
  },
  writer: CourseWriter,
): Promise<SaveGeneratedResult> {
  const validated = validateGeneratedDraft(input);
  if (!validated.ok) {
    return { ok: false, message: validated.message, course: null, step: "validation" };
  }
  return saveGeneratedDraft({ instructorId: input.instructorId, draft: validated.draft }, writer);
}

export async function saveGeneratedDraft(
  input: { instructorId: string; draft: GeneratedDraft },
  writer: CourseWriter,
): Promise<SaveGeneratedResult> {
  const course = await writer.insertCourse(
    draftCourseInsert({
      instructorId: input.instructorId,
      title: input.draft.title,
      description: input.draft.description,
      level: input.draft.level,
      categoryId: input.draft.categoryId,
    }),
  );
  if (!course.ok) return { ok: false, message: course.message, course: null, step: "course" };

  for (let index = 0; index < input.draft.lessons.length; index += 1) {
    const lesson = input.draft.lessons[index];
    if (!lesson) continue;
    const inserted = await writer.insertLesson(lessonInsert(course.course.id, lesson, index + 1));
    if (!inserted.ok) {
      return { ok: false, message: inserted.message, course: course.course, step: "lessons" };
    }
  }

  for (const assignment of input.draft.assignments) {
    const inserted = await writer.insertAssignment(assignmentInsert(course.course.id, assignment));
    if (!inserted.ok) {
      return {
        ok: false,
        message: inserted.message,
        course: course.course,
        step: "assignments",
      };
    }
  }

  return { ok: true, course: course.course };
}
