import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { panelClass } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type {
  AdminDetailSource,
  InstructorDetailSource,
  StudentDetailSource,
} from "./course-details";

type CourseDetailsLinkProps = {
  courseId: string;
  className?: string;
  children: ReactNode;
} & (
  | { role: "student"; from: StudentDetailSource }
  | { role: "instructor"; from: InstructorDetailSource }
  | { role: "admin"; from: AdminDetailSource }
);

export function CourseDetailsLink({
  courseId,
  className,
  children,
  ...target
}: CourseDetailsLinkProps) {
  const classNames = cn(
    "block min-w-0 space-y-3 rounded-sm text-left text-inherit focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    className,
  );
  if (target.role === "student") {
    return (
      <Link
        to="/student/courses/$courseId"
        params={{ courseId }}
        search={{ from: target.from }}
        className={classNames}
      >
        {children}
      </Link>
    );
  }
  if (target.role === "instructor") {
    return (
      <Link
        to="/instructor/courses/$courseId"
        params={{ courseId }}
        search={{ from: target.from }}
        className={classNames}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      to="/admin/courses/$courseId"
      params={{ courseId }}
      search={{ from: target.from }}
      className={classNames}
    >
      {children}
    </Link>
  );
}

export function CourseListing({
  title,
  badge,
  description,
  children,
  footer,
  actions,
  className,
  ...link
}: CourseDetailsLinkProps & {
  title: string;
  badge?: ReactNode;
  description?: string | null;
  footer?: ReactNode;
  actions?: ReactNode;
}) {
  const summary = description ?? "";

  return (
    <article className={cn(panelClass, "@container flex h-full flex-col space-y-3 p-4", className)}>
      <CourseDetailsLink {...link}>
        <div className="flex min-w-0 items-start gap-3">
          <h2 className="min-w-0 flex-1 text-base font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
            {title}
          </h2>
          {badge ? <div className="shrink-0 pt-0.5">{badge}</div> : null}
        </div>
        {summary ? (
          <p className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {summary}
          </p>
        ) : null}
        {children}
      </CourseDetailsLink>
      {footer}
      {actions ? <div className="mt-auto">{actions}</div> : null}
    </article>
  );
}

export function InstructorCourseLinks({ courseId }: { courseId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link to="/instructor/courses/$courseId/lessons" params={{ courseId }}>
          Lessons
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/instructor/courses/$courseId/assignments" params={{ courseId }}>
          Assignments
        </Link>
      </Button>
    </div>
  );
}
