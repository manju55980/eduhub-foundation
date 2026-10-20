import { useEffect, useState } from "react";

import { BoardSection } from "@/components/app-shell/data-table";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { MetaItem, MetaList, RecordList } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { CourseListing } from "@/features/courses/course-listing";

import { listPendingCourses, type PendingCourse } from "./approve-courses-api";
import { listAllEnrollments } from "./enrollments-api";
import type { AdminEnrollment } from "./enrollments";

const overviewEnrollmentLimit = 4;

export function AdminDashboardScreen({ fullName }: { fullName: string }) {
  const [courses, setCourses] = useState<PendingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseError, setCourseError] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([listPendingCourses(), listAllEnrollments()]).then(
      ([courseResult, enrollmentResult]) => {
        if (!active) return;
        setLoading(false);
        if (!courseResult.ok) setCourseError(courseResult.message);
        else setCourses(courseResult.courses);
        if (!enrollmentResult.ok) setEnrollmentError(enrollmentResult.message);
        else setEnrollments(enrollmentResult.enrollments.slice(0, overviewEnrollmentLimit));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const name = fullName.trim() || "Admin";

  return (
    <section className="max-w-6xl space-y-5">
      <PageHeader
        title={`Welcome back, ${name}`}
        description="Courses waiting for approval, and the newest enrollments."
      />
      {loading ? <LoadingState message="Loading dashboard…" /> : null}
      {!loading ? (
        <BoardSection title="Waiting for approval">
          {courseError ? <ErrorState message={courseError} /> : null}
          {!courseError && courses.length === 0 ? (
            <EmptyState message="No courses are waiting for approval." />
          ) : null}
          {!courseError && courses.length > 0 ? (
            <RecordList className="sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseListing
                  key={course.id}
                  role="admin"
                  from="dashboard"
                  courseId={course.id}
                  title={course.title ?? ""}
                  badge={<StatusBadge value="pending" />}
                >
                  <MetaList stacked>
                    <MetaItem label="Instructor" value={course.instructorName ?? ""} />
                    <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
                  </MetaList>
                </CourseListing>
              ))}
            </RecordList>
          ) : null}
        </BoardSection>
      ) : null}
      {!loading ? (
        <BoardSection title="Recent enrollments">
          {enrollmentError ? <ErrorState message={enrollmentError} /> : null}
          {!enrollmentError && enrollments.length === 0 ? (
            <EmptyState message="There are no enrollments yet." />
          ) : null}
          {!enrollmentError && enrollments.length > 0 ? (
            <RecordList className="sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => (
                <CourseListing
                  key={enrollment.id}
                  role="admin"
                  from="dashboard"
                  courseId={enrollment.courseId}
                  title={enrollment.title ?? ""}
                  badge={
                    <span className="flex flex-wrap justify-end gap-1">
                      {enrollment.courseStatus ? (
                        <StatusBadge value={enrollment.courseStatus} />
                      ) : null}
                      <StatusBadge value={enrollment.enrollmentStatus} />
                    </span>
                  }
                >
                  <MetaList stacked>
                    <MetaItem label="Student" value={enrollment.studentName ?? ""} />
                    <MetaItem label="Enrolled" value={formatCreatedAt(enrollment.enrolledAt)} />
                  </MetaList>
                </CourseListing>
              ))}
            </RecordList>
          ) : null}
        </BoardSection>
      ) : null}
    </section>
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
