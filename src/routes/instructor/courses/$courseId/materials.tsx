import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CourseMaterialsScreen } from "@/features/instructor/course-materials-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/courses/$courseId/materials")({
  component: CourseMaterialsPage,
});

function CourseMaterialsPage() {
  const { courseId } = Route.useParams();
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <CourseMaterialsScreen courseId={courseId} />;
}
