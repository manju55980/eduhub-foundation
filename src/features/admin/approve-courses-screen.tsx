import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

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
import { externalVideoUrl } from "@/features/student/video-url";

import { CourseMaterialList } from "@/features/courses/course-material-list";
import { materialsForCourse, type CourseMaterial } from "@/features/instructor/course-material";
import { listMaterialsForCourses } from "@/features/instructor/course-materials-api";

import { listNewestCourseReviews } from "./course-review-api";
import { reviewForCourse, type CourseReview } from "./course-review";
import { CourseReviewPanel } from "./course-review-panel";
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
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialsError, setMaterialsError] = useState("");
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [reviewsError, setReviewsError] = useState("");

  useEffect(() => {
    let active = true;
    listPendingCourses().then(async (result) => {
      if (!active) return;
      if (!result.ok) {
        setLoading(false);
        setLoadError(result.message);
        return;
      }
      const ids = result.courses.map((course) => course.id);
      const [files, savedReviews] = await Promise.all([
        listMaterialsForCourses(ids),
        listNewestCourseReviews(ids),
      ]);
      if (!active) return;
      setLoading(false);
      setCourses(result.courses);
      if (!files.ok) setMaterialsError(files.message);
      else setMaterials(files.materials);
      if (!savedReviews.ok) setReviewsError(savedReviews.message);
      else setReviews(savedReviews.reviews);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageSection>
      <PageHeader title="Approve Courses" backTo="/admin/courses" backLabel="Manage Courses" />
      <Link
        to="/admin/courses/archive"
        className="inline-flex w-fit rounded-md text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
      {materialsError ? <ErrorState message={materialsError} /> : null}
      {reviewsError ? <ErrorState message={reviewsError} /> : null}
      {loading ? <LoadingState message="Loading courses…" /> : null}
      {!loading && !loadError && courses.length === 0 ? (
        <EmptyState message="No courses are waiting for approval." />
      ) : null}
      {!loading && !loadError && courses.length > 0 ? (
        <RecordList className={recordGridClass}>
          {courses.map((course) => (
            <PendingCourseCard
              key={course.id}
              course={course}
              materials={materialsError ? null : materialsForCourse(materials, course.id)}
              review={reviewsError ? null : reviewForCourse(reviews, course.id)}
              onNotice={setNotice}
              onPublished={() =>
                setCourses((current) => current.filter((item) => item.id !== course.id))
              }
            />
          ))}
        </RecordList>
      ) : null}
    </PageSection>
  );
}

function PendingCourseCard({
  course,
  materials,
  review,
  onNotice,
  onPublished,
}: {
  course: PendingCourse;
  materials: CourseMaterial[] | null;
  review: CourseReview | null;
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

  function approveAction() {
    return (
      <Button type="button" disabled={pending} onClick={handleApprove}>
        {pending ? "Publishing…" : "Approve"}
      </Button>
    );
  }

  return (
    <CourseCard
      role="admin"
      from="approvals"
      courseId={course.id}
      title={course.title ?? ""}
      badge={<StatusBadge value="pending" />}
      description={course.description}
      level={course.level}
      instructorName={course.instructorName}
      lessons={course.lessons}
      actions={approveAction()}
      previewActions={approveAction()}
    >
      <MetaList stacked>
        <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
        <MetaItem label="Instructor" value={course.instructorName ?? ""} />
        <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
      </MetaList>
      {course.lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {course.lessons.map((lesson) => (
            <div key={lesson.id} className="space-y-2 py-3">
              <h3 className="text-sm font-medium text-foreground">{lesson.title ?? ""}</h3>
              <MetaList stacked>
                <MetaItem label="Content" value={lesson.content ?? ""} />
                <VideoUrlItem value={lesson.videoUrl} />
              </MetaList>
            </div>
          ))}
        </div>
      )}
      {materials ? <CourseMaterialList materials={materials} /> : null}
      <CourseReviewPanel courseId={course.id} review={review} />
    </CourseCard>
  );
}

function VideoUrlItem({ value }: { value: string | null }) {
  const url = externalVideoUrl(value);
  if (!url) return null;

  return (
    <MetaItem label="Video URL">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [overflow-wrap:anywhere]"
      >
        {url}
      </a>
    </MetaItem>
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
