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

export type CourseLessonRef = {
  id: string;
  courseId: string;
};

export type EnrolledCourse = EnrolledCourseSource & {
  enrollmentId: string;
  progress: number;
  completedLessons: number;
  lessonCount: number;
  enrollmentStatus: string;
  enrolledAt: string;
};

export function courseLessonProgress(
  courseId: string,
  lessons: CourseLessonRef[],
  completedLessonIds: readonly string[],
) {
  const completedIds = new Set(completedLessonIds);
  const courseLessons = lessons.filter((lesson) => lesson.courseId === courseId);
  return {
    completedLessons: courseLessons.filter((lesson) => completedIds.has(lesson.id)).length,
    lessonCount: courseLessons.length,
  };
}

export function enrolledCourses(
  enrollments: EnrollmentRow[],
  courses: EnrolledCourseSource[],
  lessons: CourseLessonRef[],
  completedLessonIds: readonly string[],
): EnrolledCourse[] {
  const byId = new Map(courses.map((course) => [course.id, course]));

  return [...enrollments]
    .sort((a, b) =>
      compareCoursesNewestFirst({ createdAt: a.enrolledAt }, { createdAt: b.enrolledAt }),
    )
    .flatMap((enrollment) => {
      const course = byId.get(enrollment.courseId);
      if (!course) return [];
      const counts = courseLessonProgress(course.id, lessons, completedLessonIds);
      return [
        {
          ...course,
          enrollmentId: enrollment.enrollmentId,
          progress: enrollment.progress,
          completedLessons: counts.completedLessons,
          lessonCount: counts.lessonCount,
          enrollmentStatus: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
        },
      ];
    });
}
