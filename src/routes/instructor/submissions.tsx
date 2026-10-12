import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { SubmissionsScreen } from "@/features/instructor/submissions-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/submissions")({
  component: SubmissionsPage,
});

function SubmissionsPage() {
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <SubmissionsScreen />;
}
