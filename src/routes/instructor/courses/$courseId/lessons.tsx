import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CourseLessonsScreen } from "@/features/instructor/course-lessons-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/courses/$courseId/lessons")({
  component: CourseLessonsPage,
});

function CourseLessonsPage() {
  const { courseId } = Route.useParams();
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <CourseLessonsScreen courseId={courseId} />;
}
