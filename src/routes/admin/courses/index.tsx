import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ManageCoursesScreen } from "@/features/admin/manage-courses-screen";

const adminRoute = getRouteApi("/admin");

export const Route = createFileRoute("/admin/courses/")({
  component: ManageCoursesPage,
});

function ManageCoursesPage() {
  const session = adminRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <ManageCoursesScreen />;
}
