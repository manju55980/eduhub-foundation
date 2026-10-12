import { supabase } from "@/integrations/supabase/client";

import type { CourseLevel } from "./course-draft";
import {
  compareCoursesNewestFirst,
  courseFieldPayload,
  pendingStatusUpdate,
} from "./course-update";

export type InstructorCourse = {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  status: string;
  categoryId: string | null;
  createdAt: string;
  lessonCount: number;
};

export async function listInstructorCourses() {
  const coursesResult = await supabase
    .from("courses")
    .select("id, title, description, level, status, category_id, created_at")
    .order("created_at", { ascending: false });
  if (coursesResult.error) return { ok: false as const, message: coursesResult.error.message };

  const lessonsResult = await supabase.from("lessons").select("course_id");
  if (lessonsResult.error) return { ok: false as const, message: lessonsResult.error.message };

  const counts = new Map<string, number>();
  for (const lesson of lessonsResult.data ?? []) {
    counts.set(lesson.course_id, (counts.get(lesson.course_id) ?? 0) + 1);
  }

  const courses = (coursesResult.data ?? [])
    .map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      level: course.level,
      status: course.status,
      categoryId: course.category_id,
      createdAt: course.created_at,
      lessonCount: counts.get(course.id) ?? 0,
    }))
    .sort(compareCoursesNewestFirst);

  return { ok: true as const, courses };
}

export async function updateCourseFields(
  courseId: string,
  changes: { title: string; description: string; level: CourseLevel; categoryId: string | null },
) {
  const { error } = await supabase
    .from("courses")
    .update(courseFieldPayload(changes))
    .eq("id", courseId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

export async function submitCourseForApproval(courseId: string) {
  const { error } = await supabase.from("courses").update(pendingStatusUpdate()).eq("id", courseId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
