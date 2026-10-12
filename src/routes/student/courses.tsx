import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { BrowseCoursesScreen } from "@/features/student/browse-courses-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/courses")({
  component: BrowseCoursesPage,
});

function BrowseCoursesPage() {
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <BrowseCoursesScreen studentId={session.userId} />;
}
