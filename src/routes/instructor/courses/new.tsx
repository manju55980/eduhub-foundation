import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CreateCourseScreen } from "@/features/instructor/create-course-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/courses/new")({
  component: CreateCoursePage,
});

function CreateCoursePage() {
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <CreateCourseScreen instructorId={session.userId} />;
}
