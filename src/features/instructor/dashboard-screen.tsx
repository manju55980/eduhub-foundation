import { useEffect, useState } from "react";

import { BoardSection } from "@/components/app-shell/data-table";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { MetaItem, MetaList, RecordCard, RecordList, pageFrameClass, recordGridClass } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { CourseListing } from "@/features/courses/course-listing";
import { listInstructorCourses, type InstructorCourse } from "./my-courses-api";
import { listInstructorSubmissions } from "./submissions-api";
import { submissionViews, type GradableSubmission } from "./submissions";

const overviewCourseLimit = 4;

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function InstructorDashboardScreen({ fullName }: { fullName: string }) {
  const [submissions, setSubmissions] = useState<GradableSubmission[]>([]);
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionError, setSubmissionError] = useState("");
  const [courseError, setCourseError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([listInstructorSubmissions(), listInstructorCourses()]).then(
      ([submissionResult, courseResult]) => {
        if (!active) return;
        setLoading(false);
        if (!submissionResult.ok) setSubmissionError(submissionResult.message);
        else setSubmissions(submissionViews(submissionResult.submissions).toGrade);
        if (!courseResult.ok) setCourseError(courseResult.message);
        else setCourses(courseResult.courses.slice(0, overviewCourseLimit));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const name = fullName.trim() || "Instructor";

  return (
    <section className={pageFrameClass}>
      <PageHeader
        title={`Welcome back, ${name}`}
        description="Submissions to grade, and your newest courses."
      />
      {loading ? <LoadingState message="Loading dashboard…" /> : null}
      {!loading ? (
        <BoardSection title="Submissions to grade">
          {submissionError ? <ErrorState message={submissionError} /> : null}
          {!submissionError && submissions.length === 0 ? (
            <EmptyState message="No submissions to grade." />
          ) : null}
          {!submissionError && submissions.length > 0 ? (
            <RecordList className={recordGridClass}>
              {submissions.map((submission) => (
                <RecordCard
                  key={submission.id}
                  className="flex h-full flex-col"
                  title={submission.assignmentTitle ?? ""}
                  badge={<StatusBadge value={submission.status} />}
                >
                  <MetaList stacked>
                    <MetaItem label="Course" value={submission.courseTitle ?? ""} />
                    <MetaItem label="Student" value={submission.studentName ?? ""} />
                    <MetaItem label="Created" value={formatCreatedAt(submission.createdAt)} />
                  </MetaList>
                </RecordCard>
              ))}
            </RecordList>
          ) : null}
        </BoardSection>
      ) : null}
      {!loading ? (
        <BoardSection title="Newest courses">
          {courseError ? <ErrorState message={courseError} /> : null}
          {!courseError && courses.length === 0 ? (
            <EmptyState message="You have no courses yet." />
          ) : null}
          {!courseError && courses.length > 0 ? (
            <RecordList className={recordGridClass}>
              {courses.map((course) => (
                <CourseListing
                  key={course.id}
                  role="instructor"
                  from="dashboard"
                  courseId={course.id}
                  title={course.title ?? ""}
                  badge={<StatusBadge value={course.status} />}
                >
                  <MetaList stacked>
                    <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
                    <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
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
