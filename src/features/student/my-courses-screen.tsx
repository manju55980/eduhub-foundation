import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import {
  MetaItem,
  MetaList,
  PageSection,
  RecordCard,
  RecordList,
} from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";

import { listEnrolledCourses } from "./my-courses-api";
import type { EnrolledCourse } from "./my-courses";

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function MyCoursesScreen({ studentId }: { studentId: string }) {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    listEnrolledCourses(studentId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCourses(result.courses);
    });
    return () => {
      active = false;
    };
  }, [studentId]);

  return (
    <PageSection>
      <PageHeader title="My Courses" />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading courses…" /> : null}
      {!loading && !loadError && courses.length === 0 ? (
        <EmptyState message="You are not enrolled in any courses.">
          <Button asChild>
            <Link to="/student/courses">Browse Courses</Link>
          </Button>
        </EmptyState>
      ) : null}
      {!loading && !loadError && courses.length > 0 ? (
        <RecordList className="sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <EnrolledCourseCard key={course.id} course={course} />
          ))}
        </RecordList>
      ) : null}
    </PageSection>
  );
}

function EnrolledCourseCard({ course }: { course: EnrolledCourse }) {
  return (
    <RecordCard
      className="flex h-full flex-col"
      title={course.title ?? ""}
      description={course.description}
    >
      <MetaList stacked>
        <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
        <MetaItem label="Status">
          <StatusBadge value={course.status} />
        </MetaItem>
        <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
        <MetaItem label="Enrollment">
          <StatusBadge value={course.enrollmentStatus} />
        </MetaItem>
        <MetaItem label="Enrolled" value={formatCreatedAt(course.enrolledAt)} />
      </MetaList>
      <div className="mt-auto">
        <Button asChild>
          <Link to="/student/my-courses/$courseId" params={{ courseId: course.id }}>
            Open course
          </Link>
        </Button>
      </div>
    </RecordCard>
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
