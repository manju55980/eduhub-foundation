import { compareCoursesNewestFirst } from "@/features/instructor/course-update";

export type AdminEnrollmentSource = {
  id: string;
  studentId: string;
  courseId: string;
  progress: number;
  status: string;
  enrolledAt: string;
};

export type AdminCourseSource = {
  id: string;
  title: string | null;
  status: string | null;
};

export type StudentName = {
  id: string;
  fullName: string | null;
};

export type AdminEnrollment = {
  id: string;
  courseId: string;
  studentName: string | null;
  title: string | null;
  courseStatus: string | null;
  progress: number;
  enrollmentStatus: string;
  enrolledAt: string;
};

export function adminEnrollments(
  enrollments: AdminEnrollmentSource[],
  courses: AdminCourseSource[],
  students: StudentName[],
): AdminEnrollment[] {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const nameById = new Map(students.map((student) => [student.id, student.fullName]));

  return [...enrollments]
    .sort((a, b) =>
      compareCoursesNewestFirst({ createdAt: a.enrolledAt }, { createdAt: b.enrolledAt }),
    )
    .flatMap((enrollment) => {
      const course = courseById.get(enrollment.courseId);
      if (!course) return [];
      return [
        {
          id: enrollment.id,
          courseId: course.id,
          studentName: nameById.has(enrollment.studentId)
            ? (nameById.get(enrollment.studentId) ?? null)
            : null,
          title: course.title,
          courseStatus: course.status,
          progress: enrollment.progress,
          enrollmentStatus: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
        },
      ];
    });
}
