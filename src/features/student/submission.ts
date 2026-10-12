import { compareCoursesNewestFirst } from "@/features/instructor/course-update";

export type AssignmentSource = {
  id: string;
  courseId: string;
  title: string | null;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
};

export type CourseTitle = {
  id: string;
  title: string | null;
};

export type SubmissionSource = {
  assignmentId: string;
  contentUrl: string | null;
  status: string;
};

export type StudentAssignment = {
  id: string;
  title: string | null;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  courseTitle: string | null;
  submission: {
    contentUrl: string | null;
    status: string;
  } | null;
};

export function submissionDraft(
  content: string,
): { ok: true; contentUrl: string } | { ok: false; message: string } {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, message: "Enter your submission." };
  return { ok: true, contentUrl: trimmed };
}

export function submissionInsert(studentId: string, assignmentId: string, contentUrl: string) {
  return {
    assignment_id: assignmentId,
    student_id: studentId,
    content_url: contentUrl,
    status: "submitted" as const,
    grade: null,
    feedback: null,
  };
}

export function studentAssignments(
  assignments: AssignmentSource[],
  courses: CourseTitle[],
  submissions: SubmissionSource[],
): StudentAssignment[] {
  const titles = new Map(courses.map((course) => [course.id, course.title]));
  const byAssignment = new Map(
    submissions.map((submission) => [submission.assignmentId, submission]),
  );

  return [...assignments].sort(compareCoursesNewestFirst).flatMap((assignment) => {
    if (!titles.has(assignment.courseId)) return [];
    const submission = byAssignment.get(assignment.id);
    return [
      {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.dueDate,
        createdAt: assignment.createdAt,
        courseTitle: titles.get(assignment.courseId) ?? null,
        submission: submission
          ? { contentUrl: submission.contentUrl, status: submission.status }
          : null,
      },
    ];
  });
}
