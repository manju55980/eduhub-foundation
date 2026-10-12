import { compareCoursesNewestFirst } from "@/features/instructor/course-update";

export type GradedSubmissionSource = {
  id: string;
  assignmentId: string;
  contentUrl: string | null;
  grade: string | null;
  feedback: string | null;
  status: string;
  createdAt: string;
};

export type AssignmentDetail = {
  id: string;
  courseId: string;
  title: string | null;
  description: string | null;
  dueDate: string | null;
};

export type CourseTitle = {
  id: string;
  title: string | null;
};

export type StudentGrade = {
  id: string;
  contentUrl: string | null;
  grade: string | null;
  feedback: string | null;
  status: string;
  createdAt: string;
  assignmentTitle: string | null;
  description: string | null;
  dueDate: string | null;
  courseTitle: string | null;
};

export function studentGrades(
  submissions: GradedSubmissionSource[],
  assignments: AssignmentDetail[],
  courses: CourseTitle[],
): StudentGrade[] {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const courseTitleById = new Map(courses.map((course) => [course.id, course.title]));

  return submissions
    .filter((submission) => submission.status === "graded")
    .sort(compareCoursesNewestFirst)
    .map((submission) => {
      const assignment = assignmentById.get(submission.assignmentId);
      const courseTitle =
        assignment && courseTitleById.has(assignment.courseId)
          ? (courseTitleById.get(assignment.courseId) ?? null)
          : null;

      return {
        id: submission.id,
        contentUrl: submission.contentUrl,
        grade: submission.grade,
        feedback: submission.feedback,
        status: submission.status,
        createdAt: submission.createdAt,
        assignmentTitle: assignment?.title ?? null,
        description: assignment?.description ?? null,
        dueDate: assignment?.dueDate ?? null,
        courseTitle,
      };
    });
}
