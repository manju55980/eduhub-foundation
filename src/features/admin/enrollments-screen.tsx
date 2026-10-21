import { useEffect, useState } from "react";

import { FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { MetaItem, MetaList, RecordList, pageFrameClass, recordGridClass } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { CourseListing } from "@/features/courses/course-listing";

import { listAllEnrollments } from "./enrollments-api";
import type { AdminEnrollment } from "./enrollments";

export function EnrollmentsScreen() {
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
    <section className={pageFrameClass}>
      <PageHeader
        title="All Enrollments"
        description="Every enrollment. Search by course or student."
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading enrollments…" /> : null}
      {!loading && !loadError && enrollments.length > 0 ? (
        <FilterToolbar
          id="enrollment-search"
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
        <RecordList className={recordGridClass}>
          {visible.map((enrollment) => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </RecordList>
      ) : null}
    </section>
  );
}

function EnrollmentCard({ enrollment }: { enrollment: AdminEnrollment }) {
  return (
    <CourseListing
      role="admin"
      from="enrollments"
      courseId={enrollment.courseId}
      title={enrollment.title ?? ""}
      badge={
        <span className="flex flex-wrap justify-end gap-1">
          {enrollment.courseStatus ? <StatusBadge value={enrollment.courseStatus} /> : null}
          <StatusBadge value={enrollment.enrollmentStatus} />
        </span>
      }
    >
      <MetaList stacked>
        <MetaItem label="Student" value={enrollment.studentName ?? ""} />
        <MetaItem label="Enrolled" value={formatCreatedAt(enrollment.enrolledAt)} />
      </MetaList>
    </CourseListing>
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
