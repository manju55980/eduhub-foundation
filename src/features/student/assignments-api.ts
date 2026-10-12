import { supabase } from "@/integrations/supabase/client";

import { studentAssignments, submissionInsert } from "./submission";

export async function listStudentAssignments(studentId: string) {
  const assignmentsResult = await supabase
    .from("assignments")
    .select("id, course_id, title, description, due_date, created_at")
    .order("created_at", { ascending: false });
  if (assignmentsResult.error) {
    return { ok: false as const, message: assignmentsResult.error.message };
  }

  const assignments = assignmentsResult.data ?? [];
  if (assignments.length === 0) return { ok: true as const, assignments: [] };

  const courseIds = [...new Set(assignments.map((assignment) => assignment.course_id))];
  const coursesResult = await supabase.from("courses").select("id, title").in("id", courseIds);
  if (coursesResult.error) return { ok: false as const, message: coursesResult.error.message };

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const submissionsResult = await supabase
    .from("submissions")
    .select("assignment_id, content_url, status")
    .eq("student_id", studentId)
    .in("assignment_id", assignmentIds);
  if (submissionsResult.error) {
    return { ok: false as const, message: submissionsResult.error.message };
  }

  return {
    ok: true as const,
    assignments: studentAssignments(
      assignments.map((assignment) => ({
        id: assignment.id,
        courseId: assignment.course_id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.due_date,
        createdAt: assignment.created_at,
      })),
      (coursesResult.data ?? []).map((course) => ({
        id: course.id,
        title: course.title,
      })),
      (submissionsResult.data ?? []).map((submission) => ({
        assignmentId: submission.assignment_id,
        contentUrl: submission.content_url,
        status: submission.status,
      })),
    ),
  };
}

export async function submitAssignment(
  studentId: string,
  assignmentId: string,
  contentUrl: string,
) {
  const { error } = await supabase
    .from("submissions")
    .insert(submissionInsert(studentId, assignmentId, contentUrl));

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
