import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import {
  MetaItem,
  MetaList,
  PageSection,
  RecordList,
  recordGridClass,
  selectFieldClass,
} from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ChoiceButton,
  FilterToolbar,
  ResultBar,
  SummaryCounts,
} from "@/components/app-shell/management";
import { CourseCard } from "@/features/courses/course-card";
import { CourseDetailsLink } from "@/features/courses/course-listing";
import { courseLevelLabel, formatCourseDate } from "@/features/courses/course-details";
import { SaveNotice } from "@/features/instructor/save-notice";
import { externalVideoUrl } from "@/features/student/video-url";

import { CourseMaterialList } from "@/features/courses/course-material-list";
import { materialsForCourse, type CourseMaterial } from "@/features/instructor/course-material";
import { listMaterialsForCourses } from "@/features/instructor/course-materials-api";

import { archiveCourse } from "./archive-courses-api";
import { listNewestCourseReviews } from "./course-review-api";
import { reviewForCourse, type CourseReview } from "./course-review";
import { CourseReviewPanel } from "./course-review-panel";
import { publishCourse } from "./approve-courses-api";
import { listAdminCourses } from "./manage-courses-api";
import {
  adminCourseEmptyMessage,
  adminCourseFilters,
  countAdminCourses,
  filterAdminCourses,
  sortAdminCourses,
  type AdminCourse,
  type AdminCourseFilter,
  type AdminCourseSort,
} from "./manage-courses";

const filterLabels: Record<AdminCourseFilter, string> = {
  all: "All",
  pending: "Pending",
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

const summaryItems: { filter: AdminCourseFilter; label: string; action: string }[] = [
  { filter: "all", label: "Total courses", action: "View all" },
  { filter: "pending", label: "Pending approval", action: "Review queue" },
  { filter: "published", label: "Published", action: "View published" },
  { filter: "draft", label: "Draft", action: "View drafts" },
  { filter: "archived", label: "Archived", action: "View archived" },
];

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function ManageCoursesScreen() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialsError, setMaterialsError] = useState("");
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [reviewsError, setReviewsError] = useState("");
  const [filter, setFilter] = useState<AdminCourseFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AdminCourseSort>("newest");

  useEffect(() => {
    let active = true;
    listAdminCourses().then(async (result) => {
      if (!active) return;
      if (!result.ok) {
        setLoading(false);
        setLoadError(result.message);
        return;
      }
      const ids = result.courses.map((course) => course.id);
      const pendingIds = result.courses
        .filter((course) => course.status === "pending")
        .map((course) => course.id);
      const [files, savedReviews] = await Promise.all([
        listMaterialsForCourses(ids),
        listNewestCourseReviews(pendingIds),
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

  const counts = useMemo(() => countAdminCourses(courses), [courses]);
  const visible = useMemo(
    () => sortAdminCourses(filterAdminCourses(courses, filter, query), sort),
    [courses, filter, query, sort],
  );

  function updateStatus(courseId: string, status: string) {
    setCourses((current) =>
      current.map((course) => (course.id === courseId ? { ...course, status } : course)),
    );
  }

  return (
    <PageSection>
      <PageHeader
        title="Course Management"
        description="Search, filter and manage all courses. Take action on approvals and archive published courses."
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {materialsError ? <ErrorState message={materialsError} /> : null}
      {reviewsError ? <ErrorState message={reviewsError} /> : null}
      {loading ? <LoadingState message="Loading courses…" /> : null}
      {!loading && !loadError ? (
        <>
          <FilterToolbar
            id="course-search"
            value={query}
            placeholder="Search courses by title or instructor..."
            onChange={setQuery}
            controlsLabel="Course status"
          >
            {adminCourseFilters.map((item) => (
              <ChoiceButton key={item} pressed={filter === item} onClick={() => setFilter(item)}>
                {filterLabels[item]}
              </ChoiceButton>
            ))}
          </FilterToolbar>
          <SummaryCounts
            value={filter}
            onChange={(next) => setFilter(next as AdminCourseFilter)}
            items={summaryItems.map((item) => ({
              value: item.filter,
              label: item.label,
              action: item.action,
              count: counts[item.filter],
            }))}
          />
          <ResultBar count={visible.length} singular="course" plural="courses">
            <div className="flex items-center gap-2">
              <Label htmlFor="course-sort">Sort by</Label>
              <select
                id="course-sort"
                value={sort}
                className={selectFieldClass}
                onChange={(event) => setSort(event.target.value as AdminCourseSort)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </ResultBar>
          <SaveNotice
            tone="admin"
            saved={notice.saved}
            message={notice.message}
            onDismiss={() => setNotice(emptyNotice)}
          />
          {visible.length === 0 ? (
            <EmptyState message={adminCourseEmptyMessage(filter, query)} />
          ) : (
            <RecordList className={recordGridClass}>
              {visible.map((course) => (
                <ManagedCourseCard
                  key={course.id}
                  course={course}
                  materials={materialsError ? null : materialsForCourse(materials, course.id)}
                  review={reviewsError ? null : reviewForCourse(reviews, course.id)}
                  onNotice={setNotice}
                  onStatus={updateStatus}
                />
              ))}
            </RecordList>
          )}
        </>
      ) : null}
    </PageSection>
  );
}

function ManagedCourseCard({
  course,
  materials,
  review,
  onNotice,
  onStatus,
}: {
  course: AdminCourse;
  materials: CourseMaterial[] | null;
  review: CourseReview | null;
  onNotice: (notice: Notice) => void;
  onStatus: (courseId: string, status: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const instructor = course.instructorName?.trim() ?? "";
  const level = courseLevelLabel(course.level);

  async function run(action: "publish" | "archive") {
    if (pending) return;
    setPending(true);
    const result =
      action === "publish" ? await publishCourse(course.id) : await archiveCourse(course.id);
    setPending(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }
    if (action === "publish") {
      onStatus(course.id, "published");
      onNotice({ saved: true, message: "This course was published." });
      return;
    }
    onStatus(course.id, "archived");
    onNotice({ saved: true, message: "This course was archived." });
  }

  function reviewActions() {
    return (
      <>
        <CourseDetailsLink
          role="admin"
          from="manage"
          courseId={course.id}
          className="text-sm font-medium text-primary"
        >
          View details
        </CourseDetailsLink>
        {course.status === "pending" ? (
          <Button type="button" disabled={pending} onClick={() => run("publish")}>
            {pending ? "Publishing…" : "Approve"}
          </Button>
        ) : null}
        {course.status === "published" ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => run("archive")}>
            {pending ? "Archiving…" : "Archive"}
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <CourseCard
      role="admin"
      from="manage"
      courseId={course.id}
      title={course.title ?? ""}
      badge={<StatusBadge value={course.status} />}
      description={course.description}
      level={course.level}
      instructorName={instructor}
      lessons={course.lessons}
      actions={reviewActions()}
      previewActions={reviewActions()}
    >
      <MetaList stacked>
        <MetaItem label="Instructor" value={instructor} />
        <MetaItem label="Level" value={level} />
        <MetaItem label="Created" value={formatCourseDate(course.createdAt)} />
      </MetaList>
      {course.status === "pending" ? <PendingLessons lessons={course.lessons} /> : null}
      {course.status === "pending" && materials ? (
        <CourseMaterialList materials={materials} />
      ) : null}
      {course.status === "pending" ? (
        <CourseReviewPanel courseId={course.id} review={review} />
      ) : null}
    </CourseCard>
  );
}

function PendingLessons({ lessons }: { lessons: AdminCourse["lessons"] }) {
  if (lessons.length === 0) {
    return <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>;
  }

  return (
    <div className="divide-y divide-border border-t border-border">
      {lessons.map((lesson) => (
        <div key={lesson.id} className="space-y-2 py-3">
          <h3 className="text-sm font-medium text-foreground">{lesson.title ?? ""}</h3>
          <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">
            {lesson.content ?? ""}
          </p>
          <VideoUrlItem value={lesson.videoUrl} />
        </div>
      ))}
    </div>
  );
}

function VideoUrlItem({ value }: { value: string | null }) {
  const url = externalVideoUrl(value);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [overflow-wrap:anywhere]"
    >
      {url}
    </a>
  );
}
