import { supabase } from "@/integrations/supabase/client";

import { listCategories } from "@/features/categories/categories-api";
import { compareCoursesNewestFirst } from "@/features/instructor/course-update";

import { enrollmentInsert } from "./enrollment";

export type CatalogueCourse = {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  categoryId: string | null;
  createdAt: string;
  enrolled: boolean;
  completed: boolean;
};

export async function listPublishedCourses(studentId: string) {
  const coursesResult = await supabase
    .from("courses")
    .select("id, title, description, level, category_id, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (coursesResult.error) return { ok: false as const, message: coursesResult.error.message };

  const enrollmentsResult = await supabase
    .from("enrollments")
    .select("course_id, status")
    .eq("student_id", studentId);
  if (enrollmentsResult.error) {
    return { ok: false as const, message: enrollmentsResult.error.message };
  }

  const categoriesResult = await listCategories();
  if (!categoriesResult.ok) return categoriesResult;

  const enrolledIds = new Set((enrollmentsResult.data ?? []).map((row) => row.course_id));
  const completedIds = new Set(
    (enrollmentsResult.data ?? [])
      .filter((row) => row.status === "completed")
      .map((row) => row.course_id),
  );
  const courses = (coursesResult.data ?? [])
    .map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      level: course.level,
      categoryId: course.category_id,
      createdAt: course.created_at,
      enrolled: enrolledIds.has(course.id),
      completed: completedIds.has(course.id),
    }))
    .sort(compareCoursesNewestFirst);

  return { ok: true as const, courses, categories: categoriesResult.categories };
}

export async function enrollInCourse(studentId: string, courseId: string) {
  const { error } = await supabase
    .from("enrollments")
    .insert(enrollmentInsert(studentId, courseId));

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
