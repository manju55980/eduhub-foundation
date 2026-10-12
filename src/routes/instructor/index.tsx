import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { InstructorDashboardScreen } from "@/features/instructor/dashboard-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/")({
  component: InstructorDashboardPage,
});

function InstructorDashboardPage() {
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <InstructorDashboardScreen fullName={session.fullName} />;
}
