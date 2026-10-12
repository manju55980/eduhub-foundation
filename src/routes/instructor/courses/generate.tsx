import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CourseBuilderScreen } from "@/features/instructor/course-builder-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/courses/generate")({
  component: CourseBuilderPage,
});

function CourseBuilderPage() {
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <CourseBuilderScreen instructorId={session.userId} />;
}
