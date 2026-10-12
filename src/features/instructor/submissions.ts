import { compareCoursesNewestFirst } from "./course-update";

export type SubmissionSource = {
  id: string;
  assignmentId: string;
  studentId: string;
  contentUrl: string | null;
  grade: string | null;
  feedback: string | null;
  status: string;
  createdAt: string;
};

export type AssignmentTitle = {
  id: string;
  courseId: string;
  title: string | null;
};

export type CourseTitle = {
  id: string;
  title: string | null;
};

export type StudentName = {
  id: string;
  fullName: string | null;
};

export type GradableSubmission = {
  id: string;
  contentUrl: string | null;
  grade: string | null;
  feedback: string | null;
  status: string;
  createdAt: string;
  assignmentTitle: string | null;
  courseTitle: string | null;
  studentName: string | null;
};

export function gradableSubmissions(
  submissions: SubmissionSource[],
  assignments: AssignmentTitle[],
  courses: CourseTitle[],
  students: StudentName[],
): GradableSubmission[] {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const courseTitleById = new Map(courses.map((course) => [course.id, course.title]));
  const nameById = new Map(students.map((student) => [student.id, student.fullName]));

  return [...submissions].sort(compareCoursesNewestFirst).map((submission) => {
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
      courseTitle,
      studentName: nameById.has(submission.studentId)
        ? (nameById.get(submission.studentId) ?? null)
        : null,
    };
  });
}

export function submissionViews(submissions: GradableSubmission[]) {
  return {
    toGrade: submissions.filter((submission) => submission.status === "submitted"),
    graded: submissions.filter((submission) => submission.status === "graded"),
  };
}
