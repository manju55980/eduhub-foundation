import type { ReactNode } from "react";

import { panelClass } from "@/components/app-shell/record-card";
import { cn } from "@/lib/utils";
import { LessonProgressSummary } from "@/features/student/lesson-progress";

import { CourseDetailsLink } from "./course-listing";
import {
  CoursePreview,
  type CoursePreviewLesson,
  type CoursePreviewProgress,
} from "./course-preview";
import type { AdminDetailSource, InstructorDetailSource, StudentDetailSource } from "./course-details";

type CourseCardTarget =
  | { role: "student"; from: StudentDetailSource; studentId?: string; enrolled?: boolean }
  | { role: "instructor"; from: InstructorDetailSource }
  | { role: "admin"; from: AdminDetailSource };

export function CourseCard({
  courseId,
  title,
  description,
  badge,
  categoryName,
  level,
  instructorName,
  progress,
  lessons,
  children,
  actions,
  previewActions,
  className,
  ...target
}: CourseCardTarget & {
  courseId: string;
  title: string;
  description?: string | null;
  badge?: ReactNode;
  categoryName?: string | null;
  level?: string;
  instructorName?: string | null;
  progress?: CoursePreviewProgress | null;
  lessons?: CoursePreviewLesson[];
  children?: ReactNode;
  actions?: ReactNode;
  previewActions?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn(panelClass, "flex h-full flex-col gap-3 p-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        <CourseDetailsLink
          {...(target.role === "student"
            ? { role: "student" as const, from: target.from }
            : target.role === "instructor"
              ? { role: "instructor" as const, from: target.from }
              : { role: "admin" as const, from: target.from })}
          courseId={courseId}
          className="min-w-0 flex-1"
        >
          <h2 className="text-base font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
            {title}
          </h2>
        </CourseDetailsLink>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {description ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {description}
        </p>
      ) : null}
      {children}
      {progress ? (
        <LessonProgressSummary
          completed={progress.completed}
          total={progress.total}
          progress={progress.percent}
        />
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <CoursePreview
          courseId={courseId}
          title={title}
          description={description}
          level={level}
          categoryName={categoryName}
          instructorName={instructorName}
          progress={progress}
          lessons={lessons}
          role={target.role}
          studentId={target.role === "student" ? target.studentId : undefined}
          enrolled={target.role === "student" ? (target.enrolled ?? false) : false}
          actions={previewActions ?? actions}
        />
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </article>
  );
}
