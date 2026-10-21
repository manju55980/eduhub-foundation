import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Save } from "lucide-react";

import { FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { RecordList, pageFrameClass, recordGridClass } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { listCategories } from "@/features/categories/categories-api";
import { CategorySelect } from "@/features/categories/category-select";
import { storedCategoryName, type CourseCategory } from "@/features/categories/category-name";

import { CourseDetailsLink, CourseListing, InstructorCourseLinks } from "@/features/courses/course-listing";
import { courseLevels } from "./course-draft";
import { canSubmitCourse, courseFieldUpdate } from "./course-update";
import {
  listInstructorCourses,
  submitCourseForApproval,
  updateCourseFields,
  type InstructorCourse,
} from "./my-courses-api";
import { SaveNotice } from "./save-notice";

const descriptionLimit = 2000;

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function MyCoursesScreen() {
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([listInstructorCourses(), listCategories()]).then(
      ([coursesResult, categoriesResult]) => {
        if (!active) return;
        setLoading(false);
        if (!coursesResult.ok) {
          setLoadError(coursesResult.message);
          return;
        }
        if (!categoriesResult.ok) {
          setLoadError(categoriesResult.message);
          return;
        }
        setCourses(coursesResult.courses);
        setCategories(categoriesResult.categories);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const visible = courses.filter((course) => matchesQuery(query, [course.title]));

  return (
    <section className={pageFrameClass}>
      <PageHeader
        title="My Courses (including lessons)"
        description="Drafts you can edit, and courses you have submitted."
      />
      <SaveNotice
        tone="instructor"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading courses…" /> : null}
      {!loading && !loadError && courses.length === 0 ? (
        <EmptyState message="You have no courses yet.">
          <Button asChild>
            <Link to="/instructor/courses/new">Create Course</Link>
          </Button>
        </EmptyState>
      ) : null}
      {!loading && !loadError && courses.length > 0 ? (
        <FilterToolbar
          id="instructor-course-search"
          value={query}
          placeholder="Search courses by title..."
          onChange={setQuery}
        />
      ) : null}
      {!loading && !loadError && courses.length > 0 && visible.length === 0 ? (
        <EmptyState message="No courses match this search." />
      ) : null}
      {!loading && !loadError && visible.length > 0 ? (
        <RecordList className={recordGridClass}>
          {visible.map((course) =>
            course.status === "draft" ? (
              <DraftCourseCard
                key={course.id}
                course={course}
                categories={categories}
                onNotice={setNotice}
                onUpdated={(changes) =>
                  setCourses((current) =>
                    current.map((item) => (item.id === course.id ? { ...item, ...changes } : item)),
                  )
                }
                onSubmitted={() =>
                  setCourses((current) =>
                    current.map((item) =>
                      item.id === course.id ? { ...item, status: "pending" } : item,
                    ),
                  )
                }
              />
            ) : (
              <CourseSummary key={course.id} course={course} categories={categories} />
            ),
          )}
        </RecordList>
      ) : null}
    </section>
  );
}

function DraftCourseCard({
  course,
  categories,
  onNotice,
  onUpdated,
  onSubmitted,
}: {
  course: InstructorCourse;
  categories: CourseCategory[];
  onNotice: (notice: Notice) => void;
  onUpdated: (changes: {
    title: string;
    description: string;
    level: string;
    categoryId: string | null;
  }) => void;
  onSubmitted: () => void;
}) {
  const [title, setTitle] = useState(course.title ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [level, setLevel] = useState(course.level);
  const [categoryId, setCategoryId] = useState(course.categoryId ?? "");
  const [pendingAction, setPendingAction] = useState<"" | "save" | "submit">("");
  const busy = pendingAction !== "";
  const canSubmit = canSubmitCourse(course.status, course.lessonCount);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const draft = courseFieldUpdate(title, description, level, categoryId);
    if (!draft.ok) {
      onNotice({ saved: false, message: draft.message });
      return;
    }

    setPendingAction("save");
    const result = await updateCourseFields(course.id, draft.changes);
    setPendingAction("");
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    setTitle(draft.changes.title);
    setDescription(draft.changes.description);
    setLevel(draft.changes.level);
    setCategoryId(draft.changes.categoryId ?? "");
    onUpdated(draft.changes);
    onNotice({ saved: true, message: "Course changes were saved." });
  }

  async function handleSubmit() {
    if (busy || !canSubmitCourse(course.status, course.lessonCount)) return;

    setPendingAction("submit");
    const result = await submitCourseForApproval(course.id);
    setPendingAction("");
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    onSubmitted();
    onNotice({ saved: true, message: "This course was submitted for approval." });
  }

  return (
    <form
      className="flex h-full flex-col space-y-4 rounded-sm border border-border bg-card p-4 shadow-none"
      onSubmit={handleSave}
    >
      <CourseDetailsLink role="instructor" from="courses" courseId={course.id}>
        <h2 className="text-base font-medium text-foreground [overflow-wrap:anywhere]">
          {course.title ?? ""}
        </h2>
        <CourseMeta course={course} />
      </CourseDetailsLink>
      <Field id={`title-${course.id}`} label="Title" hint="This will be the name of your course.">
        <Input
          id={`title-${course.id}`}
          value={title}
          placeholder="e.g. Introduction to React"
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
        />
      </Field>
      <Field id={`description-${course.id}`} label="Description" hint="Keep it clear and concise.">
        <div className="relative">
          <Textarea
            id={`description-${course.id}`}
            value={description}
            maxLength={descriptionLimit}
            placeholder="Tell learners what this course is about, what they'll learn, and who it's for..."
            className="min-h-28 pb-7"
            onChange={(event) => setDescription(event.target.value)}
            disabled={busy}
          />
          <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground">
            {description.length}/{descriptionLimit}
          </span>
        </div>
      </Field>
      <Field
        id={`level-${course.id}`}
        label="Level"
        hint="Select the appropriate level for your course."
      >
        <select
          id={`level-${course.id}`}
          className="flex h-9 w-full min-w-0 max-w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={level}
          disabled={busy}
          onChange={(event) => setLevel(event.target.value)}
        >
          <option value="">Choose a level</option>
          {courseLevels.map((item) => (
            <option key={item} value={item}>
              {levelLabels[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`category-${course.id}`} label="Category" hint="Optional." required={false}>
        <CategorySelect
          id={`category-${course.id}`}
          categories={categories}
          categoryId={categoryId}
          onChange={setCategoryId}
          disabled={busy}
        />
      </Field>
      <div className="mt-auto flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          <Save />
          {pendingAction === "save" ? "Saving…" : "Save course"}
        </Button>
        {canSubmit ? (
          <Button type="button" disabled={busy} onClick={handleSubmit}>
            {pendingAction === "submit" ? "Submitting…" : "Submit for approval"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add a lesson before submitting this course.
          </p>
        )}
        <InstructorCourseLinks courseId={course.id} />
      </div>
    </form>
  );
}

function CourseSummary({
  course,
  categories,
}: {
  course: InstructorCourse;
  categories: CourseCategory[];
}) {
  return (
    <CourseListing
      role="instructor"
      from="courses"
      courseId={course.id}
      title={course.title ?? ""}
      badge={<StatusBadge value={course.status} />}
      actions={<InstructorCourseLinks courseId={course.id} />}
    >
      <p className="line-clamp-2 text-sm text-muted-foreground">{course.description ?? ""}</p>
      <CourseMeta
        course={course}
        categoryName={storedCategoryName(categories, course.categoryId)}
        showStatus={false}
      />
    </CourseListing>
  );
}

function CourseMeta({
  course,
  categoryName,
  showStatus = true,
}: {
  course: InstructorCourse;
  categoryName?: string;
  showStatus?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showStatus ? <StatusBadge value={course.status} /> : null}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <MetaItem label="Level" value={levelLabels[course.level] ?? course.level} />
        {categoryName !== undefined ? <MetaItem label="Category" value={categoryName} /> : null}
        <MetaItem label="Created" value={formatCreatedAt(course.createdAt)} />
      </dl>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  required = true,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
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
