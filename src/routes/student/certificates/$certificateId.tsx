import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CertificateScreen } from "@/features/student/certificate-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/certificates/$certificateId")({
  component: CertificatePage,
});

function CertificatePage() {
  const { certificateId } = Route.useParams();
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return (
    <CertificateScreen
      studentId={session.userId}
      certificateId={certificateId}
      studentName={session.fullName}
    />
  );
}
