import { storedCategoryName } from "@/features/categories/category-name";
import { listCategories } from "@/features/categories/categories-api";
import { compareLessons } from "@/features/instructor/lesson-draft";
import { supabase } from "@/integrations/supabase/client";

import { toCourseDetail, type CourseDetailLesson, type CourseEnrollmentDetail } from "./course-details";

export async function getCourseDetails(
  courseId: string,
  options: { includeLessons: boolean; includeInstructor: boolean; studentId?: string },
) {
  const courseResult = await supabase
    .from("courses")
    .select("id, title, description, level, status, category_id, instructor_id, created_at")
    .eq("id", courseId)
    .maybeSingle();
  if (courseResult.error) return { ok: false as const, message: courseResult.error.message };
  const course = courseResult.data;
  if (!course) return { ok: false as const, message: "This course is not available." };

  let categoryName = "";
  if (course.category_id) {
    const categoriesResult = await listCategories();
    if (!categoriesResult.ok) return categoriesResult;
    categoryName = storedCategoryName(categoriesResult.categories, course.category_id);
  }

  let instructorName: string | null = null;
  if (options.includeInstructor) {
    const profileResult = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", course.instructor_id)
      .maybeSingle();
    if (profileResult.error) return { ok: false as const, message: profileResult.error.message };
    instructorName = profileResult.data?.full_name ?? null;
  }

  let lessons: CourseDetailLesson[] | null = null;
  if (options.includeLessons) {
    const lessonsResult = await supabase
      .from("lessons")
      .select("id, title, content, video_url, order_index, created_at")
      .eq("course_id", courseId);
    if (lessonsResult.error) return { ok: false as const, message: lessonsResult.error.message };
    lessons = (lessonsResult.data ?? [])
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.video_url,
        orderIndex: lesson.order_index,
        createdAt: lesson.created_at,
      }))
      .sort(compareLessons);
  }

  let enrollment: CourseEnrollmentDetail | null = null;
  if (options.studentId) {
    const enrollmentResult = await supabase
      .from("enrollments")
      .select("progress, status, created_at")
      .eq("course_id", courseId)
      .eq("student_id", options.studentId)
      .maybeSingle();
    if (enrollmentResult.error) return { ok: false as const, message: enrollmentResult.error.message };
    if (enrollmentResult.data) {
      enrollment = {
        progress: enrollmentResult.data.progress,
        status: enrollmentResult.data.status,
        enrolledAt: enrollmentResult.data.created_at,
      };
    }
  }

  return {
    ok: true as const,
    course: toCourseDetail({
      id: course.id,
      title: course.title,
      description: course.description,
      level: course.level,
      status: course.status,
      categoryName,
      createdAt: course.created_at,
      instructorName,
      lessons,
      enrollment,
    }),
  };
}
