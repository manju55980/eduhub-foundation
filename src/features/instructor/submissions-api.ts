import { supabase } from "@/integrations/supabase/client";

import { gradeUpdate, type GradeText } from "./grade-draft";
import { gradableSubmissions } from "./submissions";

export async function listInstructorSubmissions() {
  const submissionsResult = await supabase
    .from("submissions")
    .select("id, assignment_id, student_id, content_url, grade, feedback, status, created_at")
    .order("created_at", { ascending: false });
  if (submissionsResult.error) {
    return { ok: false as const, message: submissionsResult.error.message };
  }

  const submissions = submissionsResult.data ?? [];
  if (submissions.length === 0) return { ok: true as const, submissions: [] };

  const assignmentIds = [...new Set(submissions.map((submission) => submission.assignment_id))];
  const assignmentsResult = await supabase
    .from("assignments")
    .select("id, course_id, title")
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

  const studentIds = [...new Set(submissions.map((submission) => submission.student_id))];
  const profilesResult = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", studentIds);
  if (profilesResult.error) return { ok: false as const, message: profilesResult.error.message };

  return {
    ok: true as const,
    submissions: gradableSubmissions(
      submissions.map((submission) => ({
        id: submission.id,
        assignmentId: submission.assignment_id,
        studentId: submission.student_id,
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
      })),
      (coursesResult.data ?? []).map((course) => ({
        id: course.id,
        title: course.title,
      })),
      (profilesResult.data ?? []).map((profile) => ({
        id: profile.id,
        fullName: profile.full_name,
      })),
    ),
  };
}

export async function saveGrade(submissionId: string, grade: GradeText) {
  const { error } = await supabase
    .from("submissions")
    .update(gradeUpdate(grade))
    .eq("id", submissionId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
