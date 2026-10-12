import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ProfileScreen } from "@/features/auth/profile-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/profile")({
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <ProfileScreen userId={session.userId} title="My Profile" role={session.role} />;
}
