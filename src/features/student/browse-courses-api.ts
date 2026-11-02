import { supabase } from "@/integrations/supabase/client";

import { listCategories } from "@/features/categories/categories-api";
import { compareCoursesNewestFirst } from "@/features/instructor/course-update";
import { listCompletedLessonIds } from "@/features/notifications/notifications-api";

import { enrollmentInsert } from "./enrollment";
import { courseLessonProgress } from "./my-courses";

export type CatalogueCourse = {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  categoryId: string | null;
  createdAt: string;
  enrolled: boolean;
  completed: boolean;
  progress: number | null;
  completedLessons: number;
  lessonCount: number;
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
    .select("course_id, status, progress")
    .eq("student_id", studentId);
  if (enrollmentsResult.error) {
    return { ok: false as const, message: enrollmentsResult.error.message };
  }

  const categoriesResult = await listCategories();
  if (!categoriesResult.ok) return categoriesResult;

  const enrollments = enrollmentsResult.data ?? [];
  const enrolledIds = new Set(enrollments.map((row) => row.course_id));
  const completedIds = new Set(
    enrollments.filter((row) => row.status === "completed").map((row) => row.course_id),
  );
  const progressByCourse = new Map(enrollments.map((row) => [row.course_id, row.progress]));
  const enrolledCourseIds = [...enrolledIds];
  const lessonsResult =
    enrolledCourseIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("lessons").select("id, course_id").in("course_id", enrolledCourseIds);
  if (lessonsResult.error) return { ok: false as const, message: lessonsResult.error.message };
  const completions = await listCompletedLessonIds(studentId);
  if (!completions.ok) return completions;
  const lessons = (lessonsResult.data ?? []).map((lesson) => ({
    id: lesson.id,
    courseId: lesson.course_id,
  }));

  const courses = (coursesResult.data ?? [])
    .map((course) => {
      const enrolled = enrolledIds.has(course.id);
      const counts = enrolled
        ? courseLessonProgress(course.id, lessons, completions.lessonIds)
        : { completedLessons: 0, lessonCount: 0 };
      const stored = progressByCourse.get(course.id);
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        level: course.level,
        categoryId: course.category_id,
        createdAt: course.created_at,
        enrolled,
        completed: completedIds.has(course.id),
        progress: enrolled ? (typeof stored === "number" ? stored : 0) : null,
        completedLessons: counts.completedLessons,
        lessonCount: counts.lessonCount,
      };
    })
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
