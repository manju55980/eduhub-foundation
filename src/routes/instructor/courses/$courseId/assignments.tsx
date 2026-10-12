import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CourseAssignmentsScreen } from "@/features/instructor/course-assignments-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/courses/$courseId/assignments")({
  component: CourseAssignmentsPage,
});

function CourseAssignmentsPage() {
  const { courseId } = Route.useParams();
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <CourseAssignmentsScreen courseId={courseId} />;
}
