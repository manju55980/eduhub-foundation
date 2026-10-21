import { useEffect, useState } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { pageFrameClass } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";
import { CourseListing } from "@/features/courses/course-listing";

import { archiveCourse, listPublishedCourses, type PublishedCourse } from "./archive-courses-api";

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function ArchiveCoursesScreen() {
  const [courses, setCourses] = useState<PublishedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);

  useEffect(() => {
    let active = true;
    listPublishedCourses().then((result) => {
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
    <section className={pageFrameClass}>
      <PageHeader
        title="Archive Courses"
        backTo="/admin/courses"
        backLabel="Manage Courses"
      />
      <SaveNotice
        tone="admin"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading courses…" /> : null}
      {!loading && !loadError && courses.length === 0 ? (
        <EmptyState message="No published courses are available to archive." />
      ) : null}
      {!loading && !loadError
        ? courses.map((course) => (
            <PublishedCourseCard
              key={course.id}
              course={course}
              onNotice={setNotice}
              onArchived={() =>
                setCourses((current) => current.filter((item) => item.id !== course.id))
              }
            />
          ))
        : null}
    </section>
  );
}

function PublishedCourseCard({
  course,
  onNotice,
  onArchived,
}: {
  course: PublishedCourse;
  onNotice: (notice: Notice) => void;
  onArchived: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleArchive() {
    if (pending) return;

    setPending(true);
    const result = await archiveCourse(course.id);
    setPending(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    onArchived();
    onNotice({ saved: true, message: "This course was archived." });
  }

  return (
    <CourseListing
      role="admin"
      from="archive"
      courseId={course.id}
      title={course.title ?? ""}
      badge={<StatusBadge value="published" />}
      actions={
        <Button type="button" disabled={pending} onClick={handleArchive}>
          {pending ? "Archiving…" : "Archive"}
        </Button>
      }
    >
      <p className="line-clamp-2 text-sm text-muted-foreground">{course.description ?? ""}</p>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
        <MetaItem label="Instructor" value={course.instructorName ?? ""} />
        <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
      </dl>
    </CourseListing>
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
