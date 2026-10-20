import { useEffect, useState, type ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { MetaItem, MetaList, PageSection } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";

import { getCourseDetails } from "./course-details-api";
import {
  courseLevelLabel,
  formatCourseDate,
  statusShownToStudent,
  type CourseDetail,
} from "./course-details";
import { InstructorCourseLinks } from "./course-listing";

export function CourseDetailsScreen({
  courseId,
  backTo,
  backLabel,
  audience,
  studentId,
}: {
  courseId: string;
  backTo: LinkProps["to"];
  backLabel: string;
  audience: "student" | "instructor" | "admin";
  studentId?: string;
}) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    getCourseDetails(courseId, {
      includeLessons: audience !== "student",
      includeInstructor: audience === "admin",
      studentId,
    }).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCourse(result.course);
    });
    return () => {
      active = false;
    };
  }, [audience, courseId, studentId]);

  return (
    <PageSection>
      <PageHeader
        title={course?.title?.trim() ? course.title : "Course"}
        backTo={backTo}
        backLabel={backLabel}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading course…" /> : null}
      {!loading && !loadError && course ? (
        <div className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-none">
          <MetaList>
            <MetaItem label="Status">
              <StatusBadge
                value={
                  audience === "student"
                    ? statusShownToStudent(course.status, course.enrollment?.status)
                    : course.status
                }
              />
            </MetaItem>
            <MetaItem label="Level" value={courseLevelLabel(course.level)} />
            <MetaItem label="Category" value={course.categoryName} />
            <MetaItem label="Created" value={formatCourseDate(course.createdAt)} />
            {audience === "admin" ? (
              <MetaItem label="Instructor" value={course.instructorName ?? ""} />
            ) : null}
            {course.enrollment ? (
              <MetaItem label="Progress" value={`${course.enrollment.progress}%`} />
            ) : null}
            {course.enrollment ? (
              <MetaItem label="Enrollment">
                <StatusBadge value={course.enrollment.status} />
              </MetaItem>
            ) : null}
            {course.enrollment ? (
              <MetaItem label="Enrolled" value={formatCourseDate(course.enrollment.enrolledAt)} />
            ) : null}
          </MetaList>
          <div className="space-y-1.5">
            <h2 className="text-xs font-medium leading-snug text-muted-foreground">Description</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
              {course.description ?? ""}
            </p>
          </div>
          {course.lessons ? <LessonList lessons={course.lessons} /> : null}
          <DetailActions course={course} audience={audience} />
        </div>
      ) : null}
    </PageSection>
  );
}

function LessonList({ lessons }: { lessons: NonNullable<CourseDetail["lessons"]> }) {
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <h2 className="text-xs font-medium leading-snug text-muted-foreground">Lessons</h2>
      {lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="space-y-2 py-3">
              <h3 className="text-sm font-medium text-foreground">{lesson.title ?? ""}</h3>
              <MetaList stacked>
                <MetaItem label="Content" value={lesson.content ?? ""} />
                <MetaItem label="Video URL" value={lesson.videoUrl ?? ""} />
              </MetaList>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailActions({
  course,
  audience,
}: {
  course: CourseDetail;
  audience: "student" | "instructor" | "admin";
}) {
  let actions: ReactNode = null;
  if (audience === "student" && course.enrollment) {
    actions = (
      <Button asChild>
        <Link to="/student/my-courses/$courseId" params={{ courseId: course.id }}>
          Open course
        </Link>
      </Button>
    );
  }
  if (audience === "instructor") {
    actions = <InstructorCourseLinks courseId={course.id} />;
  }
  if (!actions) return null;
  return <div className="border-t border-border pt-4">{actions}</div>;
}
