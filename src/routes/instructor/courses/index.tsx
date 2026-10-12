import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { MyCoursesScreen } from "@/features/instructor/my-courses-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/courses/")({
  component: InstructorCoursesPage,
});

function InstructorCoursesPage() {
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <MyCoursesScreen />;
}
