import { supabase } from "@/integrations/supabase/client";

import { readFunctionResult } from "@/features/ai/function-result";
import {
  parseBuilderRequest,
  parseCoursePreview,
} from "../../../supabase/functions/_shared/course-preview.ts";

import {
  startGeneratedSave,
  type CourseWriter,
  type SaveGeneratedResult,
} from "./course-builder-save";

export async function generateCoursePreview(brief: string, level: string) {
  const parsed = parseBuilderRequest({ brief, level });
  if (!parsed.ok) return parsed;

  const { data, error } = await supabase.functions.invoke("ai-course-builder", {
    body: { brief: parsed.brief, level: parsed.level },
  });
  const result = await readFunctionResult(data, error);
  if (!result.ok) return result;
  if (!result.value || typeof result.value !== "object" || !("preview" in result.value)) {
    return { ok: false as const, message: "The AI response was not valid." };
  }
  return parseCoursePreview(result.value.preview);
}

export async function saveGeneratedCourse(
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
  writer: CourseWriter = supabaseCourseWriter,
): Promise<SaveGeneratedResult> {
  return startGeneratedSave(input, writer);
}

const supabaseCourseWriter: CourseWriter = {
  async insertCourse(row) {
    const { data, error } = await supabase.from("courses").insert(row).select("id, title").single();
    if (error) return { ok: false, message: error.message };
    return { ok: true, course: { id: data.id, title: data.title ?? "" } };
  },
  async insertLesson(row) {
    const { error } = await supabase.from("lessons").insert(row);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  },
  async insertAssignment(row) {
    const { error } = await supabase.from("assignments").insert(row);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  },
};
