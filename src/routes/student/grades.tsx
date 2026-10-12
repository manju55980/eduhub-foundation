import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { GradesScreen } from "@/features/student/grades-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/grades")({
  component: GradesPage,
});

function GradesPage() {
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <GradesScreen studentId={session.userId} />;
}
