import { useEffect, useState } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { DataCell, DataRow, DataTable } from "@/components/app-shell/data-table";
import { FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { PageSection } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";

import { listAllEnrollments } from "./enrollments-api";
import type { AdminEnrollment } from "./enrollments";

const columns = ["Course", "Student", "Progress", "Status"];

export function ReportsScreen() {
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");

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

  const visible = enrollments.filter((enrollment) =>
    matchesQuery(query, [enrollment.title, enrollment.studentName]),
  );

  return (
    <PageSection>
      <PageHeader title="Reports" description="Every enrollment, newest first." />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading reports…" /> : null}
      {!loading && !loadError && enrollments.length > 0 ? (
        <FilterToolbar
          id="report-search"
          value={query}
          placeholder="Search by course or student..."
          onChange={setQuery}
        />
      ) : null}
      {!loading && !loadError && enrollments.length === 0 ? (
        <EmptyState message="There are no enrollments yet." />
      ) : null}
      {!loading && !loadError && enrollments.length > 0 && visible.length === 0 ? (
        <EmptyState message="No enrollments match this search." />
      ) : null}
      {!loading && !loadError && visible.length > 0 ? (
        <DataTable columns={columns}>
          {visible.map((enrollment) => (
            <EnrollmentReportRow key={enrollment.id} enrollment={enrollment} />
          ))}
        </DataTable>
      ) : null}
    </PageSection>
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
      <DataCell label="Course" heading>
        <Link
          to="/admin/courses/$courseId"
          params={{ courseId: enrollment.courseId }}
          search={{ from: "reports" }}
          className="rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {enrollment.title ?? ""}
        </Link>
      </DataCell>
      <DataCell label="Student">{enrollment.studentName ?? ""}</DataCell>
      <DataCell label="Progress">{`${enrollment.progress}%`}</DataCell>
      <DataCell label="Status">
        <span className="flex flex-wrap gap-1">
          {enrollment.courseStatus ? <StatusBadge value={enrollment.courseStatus} /> : null}
          <StatusBadge value={enrollment.enrollmentStatus} />
        </span>
      </DataCell>
    </DataRow>
  );
}
