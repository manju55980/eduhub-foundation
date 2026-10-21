import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import {
  MetaItem,
  MetaList,
  PageSection,
  RecordCard,
  RecordList,
  recordGridClass,
} from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";

import { formatCertificateDate, type StudentCertificate } from "./certificates";
import { listStudentCertificates } from "./certificates-api";

export function CertificatesScreen({ studentId }: { studentId: string }) {
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    listStudentCertificates(studentId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCertificates(result.certificates);
    });
    return () => {
      active = false;
    };
  }, [studentId]);

  const visible = certificates.filter((certificate) =>
    matchesQuery(query, [certificate.courseTitle]),
  );

  return (
    <PageSection>
      <PageHeader title="My Certificates" description="Certificates for courses you have finished." />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading certificates…" /> : null}
      {!loading && !loadError && certificates.length === 0 ? (
        <EmptyState message="You have no certificates yet.">
          <Button asChild>
            <Link to="/student/my-courses">My Courses</Link>
          </Button>
        </EmptyState>
      ) : null}
      {!loading && !loadError && certificates.length > 0 ? (
        <FilterToolbar
          id="certificate-search"
          value={query}
          placeholder="Search certificates by course..."
          onChange={setQuery}
        />
      ) : null}
      {!loading && !loadError && certificates.length > 0 && visible.length === 0 ? (
        <EmptyState message="No certificates match this search." />
      ) : null}
      {!loading && !loadError && visible.length > 0 ? (
        <RecordList className={recordGridClass}>
          {visible.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} />
          ))}
        </RecordList>
      ) : null}
    </PageSection>
  );
}

function CertificateCard({ certificate }: { certificate: StudentCertificate }) {
  return (
    <RecordCard className="flex h-full flex-col" title={certificate.courseTitle}>
      <MetaList stacked>
        <MetaItem
          label="Completion date"
          value={formatCertificateDate(certificate.issuedAt)}
        />
      </MetaList>
      <div className="mt-auto">
        <Button variant="outline" asChild>
          <Link
            to="/student/certificates/$certificateId"
            params={{ certificateId: certificate.id }}
          >
            View Certificate
          </Link>
        </Button>
      </div>
    </RecordCard>
  );
}
