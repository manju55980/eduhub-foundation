import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { MetaItem, MetaList, PageSection, RecordList, recordGridClass } from "@/components/app-shell/record-card";
import { CourseListing } from "@/features/courses/course-listing";
import { statusShownToStudent } from "@/features/courses/course-details";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { CertificateIssued } from "@/features/notifications/notification-list";
import {
  listCertificates,
  shownCertificate,
  type CertificateRecord,
} from "@/features/notifications/notifications-api";

import { listEnrolledCourses } from "./my-courses-api";

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function MyCoursesScreen({ studentId }: { studentId: string }) {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [certificateError, setCertificateError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([listEnrolledCourses(studentId), listCertificates(studentId)]).then(
      ([courseResult, certificateResult]) => {
        if (!active) return;
        setLoading(false);
        if (!courseResult.ok) setLoadError(courseResult.message);
        else setCourses(courseResult.courses);
        if (!certificateResult.ok) setCertificateError(certificateResult.message);
        else setCertificates(certificateResult.certificates);
      },
    );
    return () => {
      active = false;
    };
  }, [studentId]);

  const visible = courses.filter((course) => matchesQuery(query, [course.title]));

  return (
    <PageSection>
      <PageHeader title="My Courses" description="Courses you have joined." />
      {loading ? <LoadingState message="Loading courses…" /> : null}
      {!loading && certificateError ? <ErrorState message={certificateError} /> : null}
      {!loading && loadError ? <ErrorState message={loadError} /> : null}
      {!loading && !loadError && courses.length === 0 ? (
        <EmptyState message="You are not enrolled in any courses.">
          <Button asChild>
            <Link to="/student/courses">Browse Courses</Link>
          </Button>
        </EmptyState>
      ) : null}
      {!loading && !loadError && courses.length > 0 ? (
        <FilterToolbar
          id="my-course-search"
          value={query}
          placeholder="Search courses by title..."
          onChange={setQuery}
        />
      ) : null}
      {!loading && !loadError && courses.length > 0 && visible.length === 0 ? (
        <EmptyState message="No courses match this search." />
      ) : null}
      {!loading && !loadError && visible.length > 0 ? (
        <RecordList className={recordGridClass}>
          {visible.map((course) => (
            <EnrolledCourseCard key={course.id} course={course} certificates={certificates} />
          ))}
        </RecordList>
      ) : null}
    </PageSection>
  );
}

function EnrolledCourseCard({
  course,
  certificates,
}: {
  course: EnrolledCourse;
  certificates: CertificateRecord[];
}) {
  const certificate = shownCertificate(course.enrollmentStatus, course.enrollmentId, certificates);
  return (
    <CourseListing
      role="student"
      from="my-courses"
      courseId={course.id}
      title={course.title ?? ""}
      description={course.description}
      actions={
        <>
          {certificate ? (
            <CertificateIssued title={course.title ?? ""} issuedAt={certificate.issuedAt} />
          ) : null}
          <Button asChild>
            <Link to="/student/my-courses/$courseId" params={{ courseId: course.id }}>
              Open course
            </Link>
          </Button>
        </>
      }
    >
      <MetaList stacked>
        <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
        <MetaItem label="Progress" value={`${course.progress}%`} />
        <MetaItem label="Status">
          <StatusBadge value={statusShownToStudent(course.status, course.enrollmentStatus)} />
        </MetaItem>
        <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
        <MetaItem label="Enrollment">
          <StatusBadge value={course.enrollmentStatus} />
        </MetaItem>
        <MetaItem label="Enrolled" value={formatCreatedAt(course.enrolledAt)} />
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
