import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { MetaItem, MetaList, PageSection, RecordList, recordGridClass, selectFieldClass } from "@/components/app-shell/record-card";
import { FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { CourseListing } from "@/features/courses/course-listing";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  categoriesByName,
  storedCategoryName,
  type CourseCategory,
} from "@/features/categories/category-name";
import { SaveNotice } from "@/features/instructor/save-notice";

import { enrollInCourse, listPublishedCourses, type CatalogueCourse } from "./browse-courses-api";
import { coursesInCategory } from "./catalogue";

const allCategoriesValue = "all";

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function BrowseCoursesScreen({ studentId }: { studentId: string }) {
  const [courses, setCourses] = useState<CatalogueCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);

  useEffect(() => {
    let active = true;
    listPublishedCourses(studentId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCourses(result.courses);
      setCategories(result.categories);
    });
    return () => {
      active = false;
    };
  }, [studentId]);

  const visibleCourses = coursesInCategory(courses, categoryId).filter((course) =>
    matchesQuery(query, [course.title]),
  );

  return (
    <PageSection>
      <PageHeader title="Browse Courses" />
      <SaveNotice
        tone="student"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading courses…" /> : null}
      {!loading && !loadError ? (
        <FilterToolbar
          id="catalogue-search"
          value={query}
          placeholder="Search courses by title..."
          onChange={setQuery}
          controlsLabel="Category"
        >
          <div className="min-w-0 space-y-1.5 sm:w-56">
            <Label htmlFor="catalogue-category">Category</Label>
            <select
              id="catalogue-category"
              className={`${selectFieldClass} w-full px-3`}
              value={categoryId || allCategoriesValue}
              onChange={(event) =>
                setCategoryId(event.target.value === allCategoriesValue ? "" : event.target.value)
              }
            >
              <option value={allCategoriesValue}>All categories</option>
              {categoriesByName(categories).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </FilterToolbar>
      ) : null}
      {!loading && !loadError && visibleCourses.length === 0 ? (
        <EmptyState
          message={
            query.trim()
              ? "No courses match this search."
              : categoryId
                ? "No published courses are in this category."
                : "No published courses are available."
          }
        />
      ) : null}
      {!loading && !loadError && visibleCourses.length > 0 ? (
        <RecordList className={recordGridClass}>
          {visibleCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              studentId={studentId}
              categoryName={storedCategoryName(categories, course.categoryId)}
              onNotice={setNotice}
              onEnrolled={() =>
                setCourses((current) =>
                  current.map((item) =>
                    item.id === course.id ? { ...item, enrolled: true } : item,
                  ),
                )
              }
            />
          ))}
        </RecordList>
      ) : null}
    </PageSection>
  );
}

function CourseCard({
  course,
  studentId,
  categoryName,
  onNotice,
  onEnrolled,
}: {
  course: CatalogueCourse;
  studentId: string;
  categoryName: string;
  onNotice: (notice: Notice) => void;
  onEnrolled: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleEnroll() {
    if (pending || course.enrolled) return;

    setPending(true);
    const result = await enrollInCourse(studentId, course.id);
    setPending(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    onEnrolled();
    onNotice({ saved: true, message: "You are enrolled in this course." });
  }

  return (
    <CourseListing
      role="student"
      from="browse"
      courseId={course.id}
      title={course.title ?? ""}
      badge={<StatusBadge value={course.completed ? "completed" : "published"} />}
      description={course.description}
      actions={
        course.enrolled ? (
          <Button asChild>
            <Link to="/student/my-courses/$courseId" params={{ courseId: course.id }}>
              Open course
            </Link>
          </Button>
        ) : (
          <Button type="button" disabled={pending} onClick={handleEnroll}>
            {pending ? "Enrolling…" : "Enroll"}
          </Button>
        )
      }
    >
      <MetaList stacked>
        <MetaItem label="Category" value={categoryName} />
        <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
        <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
      </MetaList>
    </CourseListing>
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
