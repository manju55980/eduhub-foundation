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
  type StudentDetailSource,
} from "./course-details";
import { InstructorCourseLinks } from "./course-listing";
import { CourseMaterialList } from "./course-material-list";
import { listCourseMaterials } from "@/features/instructor/course-materials-api";
import type { CourseMaterial } from "@/features/instructor/course-material";

export function CourseDetailsScreen({
  courseId,
  backTo,
  backLabel,
  audience,
  studentId,
  learningFrom = "browse",
}: {
  courseId: string;
  backTo: LinkProps["to"];
  backLabel: string;
  audience: "student" | "instructor" | "admin";
  studentId?: string;
  learningFrom?: StudentDetailSource;
}) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialsError, setMaterialsError] = useState("");

  useEffect(() => {
    let active = true;
    setMaterials([]);
    setMaterialsError("");
    const details = getCourseDetails(courseId, {
      includeLessons: audience !== "student",
      includeInstructor: audience === "admin",
      ...(studentId !== undefined ? { studentId } : {}),
    });
    const files =
      audience === "admin"
        ? listCourseMaterials(courseId)
        : Promise.resolve({ ok: true as const, materials: [] as CourseMaterial[] });
    Promise.all([details, files]).then(([result, materialsResult]) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCourse(result.course);
      if (!materialsResult.ok) {
        setMaterialsError(materialsResult.message);
        return;
      }
      setMaterials(materialsResult.materials);
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
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-raised transition-[color,background-color,border-color,box-shadow] duration-200 ease-standard motion-reduce:transition-none">
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
          {audience === "admin" ? (
            materialsError ? (
              <ErrorState message={materialsError} />
            ) : (
              <CourseMaterialList materials={materials} />
            )
          ) : null}
          <DetailActions course={course} audience={audience} learningFrom={learningFrom} />
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
  learningFrom,
}: {
  course: CourseDetail;
  audience: "student" | "instructor" | "admin";
  learningFrom: StudentDetailSource;
}) {
  let actions: ReactNode = null;
  if (audience === "student" && course.enrollment) {
    actions = (
      <Button asChild>
        <Link
          to="/student/my-courses/$courseId"
          params={{ courseId: course.id }}
          search={{ from: learningFrom }}
        >
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
