import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { UsersScreen } from "@/features/admin/users-screen";

const adminRoute = getRouteApi("/admin");

export const Route = createFileRoute("/admin/users")({
  component: ManageUsersPage,
});

function ManageUsersPage() {
  const session = adminRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <UsersScreen adminId={session.userId} />;
}
