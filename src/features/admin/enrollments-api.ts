import { supabase } from "@/integrations/supabase/client";

import { adminEnrollments } from "./enrollments";

export async function listAllEnrollments() {
  const enrollmentsResult = await supabase
    .from("enrollments")
    .select("id, student_id, course_id, progress, status, created_at")
    .order("created_at", { ascending: false });
  if (enrollmentsResult.error) {
    return { ok: false as const, message: enrollmentsResult.error.message };
  }

  const enrollments = enrollmentsResult.data ?? [];
  if (enrollments.length === 0) return { ok: true as const, enrollments: [] };

  const courseIds = [...new Set(enrollments.map((enrollment) => enrollment.course_id))];
  const coursesResult = await supabase
    .from("courses")
    .select("id, title, status")
    .in("id", courseIds);
  if (coursesResult.error) return { ok: false as const, message: coursesResult.error.message };

  const studentIds = [...new Set(enrollments.map((enrollment) => enrollment.student_id))];
  const profilesResult = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", studentIds);
  if (profilesResult.error) return { ok: false as const, message: profilesResult.error.message };

  return {
    ok: true as const,
    enrollments: adminEnrollments(
      enrollments.map((enrollment) => ({
        id: enrollment.id,
        studentId: enrollment.student_id,
        courseId: enrollment.course_id,
        progress: enrollment.progress,
        status: enrollment.status,
        enrolledAt: enrollment.created_at,
      })),
      (coursesResult.data ?? []).map((course) => ({
        id: course.id,
        title: course.title,
        status: course.status,
      })),
      (profilesResult.data ?? []).map((profile) => ({
        id: profile.id,
        fullName: profile.full_name,
      })),
    ),
  };
}
