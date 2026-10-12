import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { AssignmentsScreen } from "@/features/student/assignments-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/assignments")({
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <AssignmentsScreen studentId={session.userId} />;
}
