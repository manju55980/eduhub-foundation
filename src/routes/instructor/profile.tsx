import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ProfileScreen } from "@/features/auth/profile-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/profile")({
  component: InstructorProfilePage,
});

function InstructorProfilePage() {
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <ProfileScreen userId={session.userId} title="Profile" role={session.role} />;
}
