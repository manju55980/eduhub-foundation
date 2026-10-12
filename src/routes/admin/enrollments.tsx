import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { EnrollmentsScreen } from "@/features/admin/enrollments-screen";

const adminRoute = getRouteApi("/admin");

export const Route = createFileRoute("/admin/enrollments")({
  component: EnrollmentsPage,
});

function EnrollmentsPage() {
  const session = adminRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <EnrollmentsScreen />;
}
