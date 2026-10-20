import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import {
  instructorDetailReturn,
  isInstructorDetailSource,
} from "@/features/courses/course-details";
import { CourseDetailsScreen } from "@/features/courses/course-details-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/courses/$courseId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: isInstructorDetailSource(search.from) ? search.from : "courses",
  }),
  component: InstructorCourseDetailsPage,
});

function InstructorCourseDetailsPage() {
  const { courseId } = Route.useParams();
  const { from } = Route.useSearch();
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  const back = instructorDetailReturn(from);
  return (
    <CourseDetailsScreen
      courseId={courseId}
      backTo={back.to}
      backLabel={back.label}
      audience="instructor"
    />
  );
}
