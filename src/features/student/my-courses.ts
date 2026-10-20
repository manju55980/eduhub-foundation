import { compareCoursesNewestFirst } from "@/features/instructor/course-update";

export type EnrollmentRow = {
  enrollmentId: string;
  courseId: string;
  progress: number;
  status: string;
  enrolledAt: string;
};

export type EnrolledCourseSource = {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  status: string;
  createdAt: string;
};

export type EnrolledCourse = EnrolledCourseSource & {
  enrollmentId: string;
  progress: number;
  enrollmentStatus: string;
  enrolledAt: string;
};

export function enrolledCourses(
  enrollments: EnrollmentRow[],
  courses: EnrolledCourseSource[],
): EnrolledCourse[] {
  const byId = new Map(courses.map((course) => [course.id, course]));

  return [...enrollments]
    .sort((a, b) =>
      compareCoursesNewestFirst({ createdAt: a.enrolledAt }, { createdAt: b.enrolledAt }),
    )
    .flatMap((enrollment) => {
      const course = byId.get(enrollment.courseId);
      if (!course) return [];
      return [
        {
          ...course,
          enrollmentId: enrollment.enrollmentId,
          progress: enrollment.progress,
          enrollmentStatus: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
        },
      ];
    });
}
