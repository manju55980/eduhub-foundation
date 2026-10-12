import { supabase } from "@/integrations/supabase/client";

import { studentGrades } from "./grades";

export async function listStudentGrades(studentId: string) {
  const submissionsResult = await supabase
    .from("submissions")
    .select("id, assignment_id, content_url, grade, feedback, status, created_at")
    .eq("student_id", studentId)
    .eq("status", "graded")
    .order("created_at", { ascending: false });
  if (submissionsResult.error) {
    return { ok: false as const, message: submissionsResult.error.message };
  }

  const submissions = submissionsResult.data ?? [];
  if (submissions.length === 0) return { ok: true as const, grades: [] };

  const assignmentIds = [...new Set(submissions.map((submission) => submission.assignment_id))];
  const assignmentsResult = await supabase
    .from("assignments")
    .select("id, course_id, title, description, due_date")
    .in("id", assignmentIds);
  if (assignmentsResult.error) {
    return { ok: false as const, message: assignmentsResult.error.message };
  }

  const courseIds = [
    ...new Set((assignmentsResult.data ?? []).map((assignment) => assignment.course_id)),
  ];
  const coursesResult =
    courseIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("courses").select("id, title").in("id", courseIds);
  if (coursesResult.error) return { ok: false as const, message: coursesResult.error.message };

  return {
    ok: true as const,
    grades: studentGrades(
      submissions.map((submission) => ({
        id: submission.id,
        assignmentId: submission.assignment_id,
        contentUrl: submission.content_url,
        grade: submission.grade,
        feedback: submission.feedback,
        status: submission.status,
        createdAt: submission.created_at,
      })),
      (assignmentsResult.data ?? []).map((assignment) => ({
        id: assignment.id,
        courseId: assignment.course_id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.due_date,
      })),
      (coursesResult.data ?? []).map((course) => ({
        id: course.id,
        title: course.title,
      })),
    ),
  };
}
