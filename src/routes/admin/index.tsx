import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { AdminDashboardScreen } from "@/features/admin/dashboard-screen";

const adminRoute = getRouteApi("/admin");

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const session = adminRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <AdminDashboardScreen fullName={session.fullName} />;
}
