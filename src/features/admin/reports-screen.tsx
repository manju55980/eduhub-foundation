import { useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { DataCell, DataRow, DataTable } from "@/components/app-shell/data-table";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { StatusBadge } from "@/components/app-shell/status-badge";

import { listAllEnrollments } from "./enrollments-api";
import type { AdminEnrollment } from "./enrollments";

const columns = ["Course", "Student", "Status", "Enrollment", "Enrolled"];

export function ReportsScreen() {
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    listAllEnrollments().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setEnrollments(result.enrollments);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="max-w-6xl space-y-4">
      <PageHeader title="Reports" description="Every enrollment, newest first." />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading reports…" /> : null}
      {!loading && !loadError && enrollments.length === 0 ? (
        <EmptyState message="There are no enrollments yet." />
      ) : null}
      {!loading && !loadError && enrollments.length > 0 ? (
        <DataTable columns={columns}>
          {enrollments.map((enrollment) => (
            <EnrollmentReportRow key={enrollment.id} enrollment={enrollment} />
          ))}
        </DataTable>
      ) : null}
    </section>
  );
}

function EnrollmentReportRow({ enrollment }: { enrollment: AdminEnrollment }) {
  const navigate = useNavigate();

  function openCourse() {
    void navigate({
      to: "/admin/courses/$courseId",
      params: { courseId: enrollment.courseId },
      search: { from: "reports" },
    });
  }

  return (
    <DataRow
      onClick={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("a, button")) return;
        openCourse();
      }}
    >
      <DataCell heading>
        <button type="button" className="text-left font-medium" onClick={openCourse}>
          {enrollment.title ?? ""}
        </button>
      </DataCell>
      <DataCell>{enrollment.studentName ?? ""}</DataCell>
      <DataCell>
        {enrollment.courseStatus ? <StatusBadge value={enrollment.courseStatus} /> : null}
      </DataCell>
      <DataCell>
        <StatusBadge value={enrollment.enrollmentStatus} />
      </DataCell>
      <DataCell>{formatCreatedAt(enrollment.enrolledAt)}</DataCell>
    </DataRow>
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
