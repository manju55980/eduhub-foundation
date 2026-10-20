import { useEffect, useState } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { PageSection } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";

import { buildCertificatePdf } from "./certificate-pdf";
import { formatCertificateDate, type StudentCertificate } from "./certificates";
import { getStudentCertificate } from "./certificates-api";

export function CertificateScreen({
  studentId,
  certificateId,
  studentName,
}: {
  studentId: string;
  certificateId: string;
  studentName: string;
}) {
  const [certificate, setCertificate] = useState<StudentCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    getStudentCertificate(studentId, certificateId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCertificate(result.certificate);
    });
    return () => {
      active = false;
    };
  }, [certificateId, studentId]);

  const completedOn = certificate ? formatCertificateDate(certificate.issuedAt, "long") : "";

  return (
    <PageSection className="max-w-5xl">
      <div className="print:hidden">
        <PageHeader
          title={certificate?.courseTitle?.trim() ? certificate.courseTitle : "Certificate"}
          backTo="/student/certificates"
          backLabel="My Certificates"
        />
      </div>
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading certificate…" /> : null}
      {!loading && !loadError && certificate ? (
        <>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button type="button" onClick={() => window.print()}>
              Print
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadCertificate(certificate, studentName, completedOn)}
            >
              Download PDF
            </Button>
          </div>
          <CertificateDocument
            studentName={studentName}
            courseTitle={certificate.courseTitle}
            completedOn={completedOn}
            certificateId={certificate.id}
          />
        </>
      ) : null}
    </PageSection>
  );
}

export function CertificateDocument({
  studentName,
  courseTitle,
  completedOn,
  certificateId,
}: {
  studentName: string;
  courseTitle: string;
  completedOn: string;
  certificateId: string;
}) {
  return (
    <>
      <style>{printStyle}</style>
      <article className="certificate-print mx-auto w-full max-w-5xl bg-[#fbf7ef] text-[#1c2430] shadow-sm print:max-w-none print:shadow-none">
        <div className="aspect-[11/8.5] border-[10px] border-[#1e3a5f] p-2 sm:border-[14px] sm:p-3">
          <div className="flex h-full min-h-0 flex-col border-2 border-[#b0893f] px-6 py-5 sm:px-10 sm:py-8">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-[#1e3a5f]">
              EduHub
            </p>
            <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[#1e3a5f] sm:text-3xl">
              Certificate of Completion
            </h2>
            <p className="mt-6 text-center text-sm text-[#3d4a5c]">This certifies that</p>
            <p className="mt-2 text-center text-2xl font-semibold [overflow-wrap:anywhere] sm:text-3xl">
              {studentName}
            </p>
            <p className="mt-4 text-center text-sm text-[#3d4a5c]">has successfully completed</p>
            <p className="mt-2 text-center text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl">
              {courseTitle}
            </p>
            <p className="mt-6 text-center text-sm">Completed on {completedOn}</p>
            <div className="mt-auto flex items-end justify-between gap-4 pt-6">
              <p className="min-w-0 text-xs [overflow-wrap:anywhere] text-[#3d4a5c]">
                Certificate ID
                <span className="mt-1 block font-medium text-[#1c2430]">{certificateId}</span>
              </p>
              <div
                className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-[#b0893f] text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#1e3a5f] sm:size-24 sm:text-xs"
                aria-label="EduHub achievement seal"
              >
                EduHub
                <br />
                Seal
              </div>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}

function downloadCertificate(
  certificate: StudentCertificate,
  studentName: string,
  completedOn: string,
) {
  const bytes = buildCertificatePdf({
    studentName,
    courseTitle: certificate.courseTitle,
    completedOn,
    certificateId: certificate.id,
  });
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `eduhub-certificate-${certificate.id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

const printStyle = `
@media print {
  body * { visibility: hidden; }
  .certificate-print, .certificate-print * { visibility: visible; }
  .certificate-print { position: absolute; inset: 0; width: 100%; }
  @page { size: landscape; margin: 12mm; }
}
`;
