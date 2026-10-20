import { supabase } from "@/integrations/supabase/client";

import { visibleCertificates, type CertificateSource } from "./certificates";

type CertificateFilter = PromiseLike<{
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
}> & {
  eq(column: string, value: string): CertificateFilter;
  order(column: string, options: { ascending: boolean }): CertificateFilter;
  maybeSingle(): PromiseLike<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
};

function certificatesTable() {
  return (
    supabase as unknown as {
      from(table: "certificates"): {
        select(columns: string): { eq(column: string, value: string): CertificateFilter };
      };
    }
  ).from("certificates");
}

export async function listStudentCertificates(studentId: string) {
  const certificateResult = await certificatesTable()
    .select("id, enrollment_id, course_id, issued_at")
    .eq("student_id", studentId)
    .order("issued_at", { ascending: false });
  if (certificateResult.error) {
    return { ok: false as const, message: certificateResult.error.message };
  }
  const certificates = (certificateResult.data ?? []).flatMap(certificateSource);
  return assembleCertificates(certificates);
}

export async function getStudentCertificate(studentId: string, certificateId: string) {
  const certificateResult = await certificatesTable()
    .select("id, enrollment_id, course_id, issued_at")
    .eq("id", certificateId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (certificateResult.error) {
    return { ok: false as const, message: certificateResult.error.message };
  }
  const certificate = certificateResult.data ? certificateSource(certificateResult.data) : [];
  if (certificate.length === 0) {
    return { ok: false as const, message: "This certificate is not available." };
  }
  const assembled = await assembleCertificates(certificate);
  if (!assembled.ok) return assembled;
  const match = assembled.certificates[0];
  if (!match) return { ok: false as const, message: "This certificate is not available." };
  return { ok: true as const, certificate: match };
}

async function assembleCertificates(certificates: CertificateSource[]) {
  if (certificates.length === 0) return { ok: true as const, certificates: [] };

  const enrollmentIds = [...new Set(certificates.map((row) => row.enrollmentId))];
  const enrollmentResult = await supabase
    .from("enrollments")
    .select("id, status")
    .in("id", enrollmentIds);
  if (enrollmentResult.error) {
    return { ok: false as const, message: enrollmentResult.error.message };
  }

  const courseIds = [...new Set(certificates.map((row) => row.courseId).filter(Boolean))];
  const courseResult = await supabase.from("courses").select("id, title").in("id", courseIds);
  if (courseResult.error) return { ok: false as const, message: courseResult.error.message };

  return {
    ok: true as const,
    certificates: visibleCertificates(
      certificates,
      enrollmentResult.data ?? [],
      (courseResult.data ?? []).map((course) => ({ id: course.id, title: course.title })),
    ),
  };
}

function certificateSource(row: Record<string, unknown>): CertificateSource[] {
  const id = text(row, "id");
  const enrollmentId = text(row, "enrollment_id");
  const courseId = text(row, "course_id");
  const issuedAt = text(row, "issued_at");
  if (!id || !enrollmentId || !courseId || !issuedAt) return [];
  return [{ id, enrollmentId, courseId, issuedAt }];
}

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}
