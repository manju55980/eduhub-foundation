import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { MyCoursesScreen } from "@/features/student/my-courses-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/my-courses/")({
  component: MyCoursesPage,
});

function MyCoursesPage() {
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <MyCoursesScreen studentId={session.userId} />;
}
