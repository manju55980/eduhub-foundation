import { supabase } from "@/integrations/supabase/client";

import { enrolledCourses } from "./my-courses";

export async function listEnrolledCourses(studentId: string) {
  const enrollmentsResult = await supabase
    .from("enrollments")
    .select("id, course_id, progress, status, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (enrollmentsResult.error) {
    return { ok: false as const, message: enrollmentsResult.error.message };
  }

  const enrollments = enrollmentsResult.data ?? [];
  if (enrollments.length === 0) return { ok: true as const, courses: [] };

  const courseIds = [...new Set(enrollments.map((row) => row.course_id))];
  const coursesResult = await supabase
    .from("courses")
    .select("id, title, description, level, status, created_at")
    .in("id", courseIds);
  if (coursesResult.error) return { ok: false as const, message: coursesResult.error.message };

  return {
    ok: true as const,
    courses: enrolledCourses(
      enrollments.map((row) => ({
        enrollmentId: row.id,
        courseId: row.course_id,
        progress: row.progress,
        status: row.status,
        enrolledAt: row.created_at,
      })),
      (coursesResult.data ?? []).map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        level: course.level,
        status: course.status,
        createdAt: course.created_at,
      })),
    ),
  };
}
