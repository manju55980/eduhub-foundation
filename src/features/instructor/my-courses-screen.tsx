import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Save } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { RecordList } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { listCategories } from "@/features/categories/categories-api";
import { CategorySelect } from "@/features/categories/category-select";
import { storedCategoryName, type CourseCategory } from "@/features/categories/category-name";

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

  return (
    <section className="max-w-6xl space-y-4">
      <PageHeader title="My Courses (including lessons)" />
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
        <RecordList className="sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) =>
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
      <CourseMeta course={course} />
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
        <Select
          key={level || "none"}
          {...(level ? { value: level } : {})}
          onValueChange={setLevel}
          disabled={busy}
        >
          <SelectTrigger id={`level-${course.id}`} className="w-full">
            <SelectValue placeholder="Choose a level" />
          </SelectTrigger>
          <SelectContent>
            {courseLevels.map((item) => (
              <SelectItem key={item} value={item}>
                {levelLabels[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <CourseLinks courseId={course.id} />
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
    <article className="flex h-full flex-col space-y-3 rounded-sm border border-border bg-card p-4 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">{course.title ?? ""}</h2>
        <StatusBadge value={course.status} />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{course.description ?? ""}</p>
      <CourseMeta
        course={course}
        categoryName={storedCategoryName(categories, course.categoryId)}
        showStatus={false}
      />
      <div className="mt-auto flex flex-wrap gap-3">
        <CourseLinks courseId={course.id} />
      </div>
    </article>
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

function CourseLinks({ courseId }: { courseId: string }) {
  return (
    <>
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
    </>
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
