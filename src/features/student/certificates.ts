export type CertificateSource = {
  id: string;
  enrollmentId: string;
  courseId: string;
  issuedAt: string;
};

export type StudentCertificate = {
  id: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
};

export function visibleCertificates(
  certificates: CertificateSource[],
  enrollments: Array<{ id: string; status: string }>,
  courses: Array<{ id: string; title: string | null }>,
) {
  const completed = new Set(
    enrollments.filter((row) => row.status === "completed").map((row) => row.id),
  );
  const titles = new Map(courses.map((course) => [course.id, course.title ?? ""]));
  return certificates
    .filter((row) => row.id && row.enrollmentId && completed.has(row.enrollmentId))
    .map((row) => ({
      id: row.id,
      courseId: row.courseId,
      courseTitle: titles.get(row.courseId) ?? "",
      issuedAt: row.issuedAt,
    }))
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
}

export function formatCertificateDate(value: string, style: "short" | "long" = "short") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: style === "long" ? "long" : "short",
    day: "numeric",
  }).format(date);
}
