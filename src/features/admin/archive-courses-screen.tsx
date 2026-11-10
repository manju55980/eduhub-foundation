import { useEffect, useState } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import {
  MetaItem,
  MetaList,
  PageSection,
  RecordList,
  recordGridClass,
} from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";
import { CourseCard } from "@/features/courses/course-card";

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
    <PageSection>
      <PageHeader title="Archive Courses" backTo="/admin/courses" backLabel="Manage Courses" />
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
      {!loading && !loadError && courses.length > 0 ? (
        <RecordList className={recordGridClass}>
          {courses.map((course) => (
            <PublishedCourseCard
              key={course.id}
              course={course}
              onNotice={setNotice}
              onArchived={() =>
                setCourses((current) => current.filter((item) => item.id !== course.id))
              }
            />
          ))}
        </RecordList>
      ) : null}
    </PageSection>
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

  function archiveAction() {
    return (
      <Button type="button" disabled={pending} onClick={handleArchive}>
        {pending ? "Archiving…" : "Archive"}
      </Button>
    );
  }

  return (
    <CourseCard
      role="admin"
      from="archive"
      courseId={course.id}
      title={course.title ?? ""}
      badge={<StatusBadge value="published" />}
      description={course.description}
      level={course.level}
      instructorName={course.instructorName}
      actions={archiveAction()}
      previewActions={archiveAction()}
    >
      <MetaList stacked>
        <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
        <MetaItem label="Instructor" value={course.instructorName ?? ""} />
        <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
      </MetaList>
    </CourseCard>
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
