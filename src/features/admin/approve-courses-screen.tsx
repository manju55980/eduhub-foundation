import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { RecordList } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";

import { listPendingCourses, publishCourse, type PendingCourse } from "./approve-courses-api";

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function ApproveCoursesScreen() {
  const [courses, setCourses] = useState<PendingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);

  useEffect(() => {
    let active = true;
    listPendingCourses().then((result) => {
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
  }, []);

  return (
    <section className="max-w-6xl space-y-4">
      <PageHeader title="Approve Courses" />
      <Link
        to="/admin/courses/archive"
        className="inline-flex text-sm text-muted-foreground hover:text-foreground"
      >
        Archive a published course
      </Link>
      <SaveNotice
        tone="admin"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading courses…" /> : null}
      {!loading && !loadError && courses.length === 0 ? (
        <EmptyState message="No courses are waiting for approval." />
      ) : null}
      {!loading && !loadError && courses.length > 0 ? (
        <RecordList className="sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <PendingCourseCard
              key={course.id}
              course={course}
              onNotice={setNotice}
              onPublished={() =>
                setCourses((current) => current.filter((item) => item.id !== course.id))
              }
            />
          ))}
        </RecordList>
      ) : null}
    </section>
  );
}

function PendingCourseCard({
  course,
  onNotice,
  onPublished,
}: {
  course: PendingCourse;
  onNotice: (notice: Notice) => void;
  onPublished: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleApprove() {
    if (pending) return;

    setPending(true);
    const result = await publishCourse(course.id);
    setPending(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    onPublished();
    onNotice({ saved: true, message: "This course was published." });
  }

  return (
    <article className="flex h-full flex-col space-y-3 rounded-sm border border-border bg-card p-4 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">{course.title ?? ""}</h2>
        <StatusBadge value="pending" />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{course.description ?? ""}</p>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
        <MetaItem label="Instructor" value={course.instructorName ?? ""} />
        <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
      </dl>
      {course.lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {course.lessons.map((lesson) => (
            <div key={lesson.id} className="space-y-2 py-3">
              <h3 className="text-sm font-medium text-foreground">{lesson.title ?? ""}</h3>
              <dl className="space-y-2 text-sm">
                <MetaItem label="Content" value={lesson.content ?? ""} />
                <MetaItem label="Video URL" value={lesson.videoUrl ?? ""} />
              </dl>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto">
        <Button type="button" disabled={pending} onClick={handleApprove}>
          {pending ? "Publishing…" : "Approve"}
        </Button>
      </div>
    </article>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-foreground">{value}</dd>
    </div>
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
