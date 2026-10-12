import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ApproveCoursesScreen } from "@/features/admin/approve-courses-screen";

const adminRoute = getRouteApi("/admin");

export const Route = createFileRoute("/admin/courses/approvals")({
  component: ApproveCoursesPage,
});

function ApproveCoursesPage() {
  const session = adminRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <ApproveCoursesScreen />;
}
