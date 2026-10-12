import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ArchiveCoursesScreen } from "@/features/admin/archive-courses-screen";

const adminRoute = getRouteApi("/admin");

export const Route = createFileRoute("/admin/courses/archive")({
  component: ArchiveCoursesPage,
});

function ArchiveCoursesPage() {
  const session = adminRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <ArchiveCoursesScreen />;
}
