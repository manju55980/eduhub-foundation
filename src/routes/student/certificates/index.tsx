import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CertificatesScreen } from "@/features/student/certificates-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/certificates/")({
  component: CertificatesPage,
});

function CertificatesPage() {
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <CertificatesScreen studentId={session.userId} />;
}
