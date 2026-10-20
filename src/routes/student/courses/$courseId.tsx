import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import {
  isStudentDetailSource,
  studentDetailReturn,
} from "@/features/courses/course-details";
import { CourseDetailsScreen } from "@/features/courses/course-details-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/courses/$courseId")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: isStudentDetailSource(search.from) ? search.from : "browse",
  }),
  component: StudentCourseDetailsPage,
});

function StudentCourseDetailsPage() {
  const { courseId } = Route.useParams();
  const { from } = Route.useSearch();
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  const back = studentDetailReturn(from);
  return (
    <CourseDetailsScreen
      courseId={courseId}
      backTo={back.to}
      backLabel={back.label}
      audience="student"
      studentId={session.userId}
    />
  );
}
