import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { RecordCard } from "@/components/app-shell/record-card";
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
import type { CourseCategory } from "@/features/categories/category-name";
import { SaveNotice } from "@/features/instructor/save-notice";
import { descriptionLimit } from "../../../supabase/functions/_shared/course-preview.ts";

import { generateCoursePreview, saveGeneratedCourse } from "./course-builder-api";
import { courseLevels } from "./course-draft";

const levelLabels: Record<(typeof courseLevels)[number], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type PreviewFields = {
  level: string;
  categoryId: string;
  title: string;
  description: string;
  lessons: Array<{ title: string; content: string }>;
  assignments: Array<{ title: string; description: string }>;
};

type CreatedDraft = {
  id: string;
  title: string;
  complete: boolean;
};

export function CourseBuilderScreen({ instructorId }: { instructorId: string }) {
  const [brief, setBrief] = useState("");
  const [level, setLevel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<"generate" | "save" | null>(null);
  const [preview, setPreview] = useState<PreviewFields | null>(null);
  const [created, setCreated] = useState<CreatedDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  const locked = created !== null && !created.complete;

  useEffect(() => {
    let active = true;
    listCategories().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCategories(result.categories);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || locked || loadError || preview) return;

    setPending("generate");
    setSaved(false);
    setMessage("");
    const result = await generateCoursePreview(brief, level);
    setPending(null);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    if (created?.complete) setCreated(null);
    setPreview({
      level,
      categoryId,
      title: result.preview.title,
      description: result.preview.description,
      lessons: result.preview.lessons,
      assignments: result.preview.assignments,
    });
  }

  async function handleSave() {
    if (!preview || pending || locked) return;

    setPending("save");
    setSaved(false);
    setMessage("");
    const result = await saveGeneratedCourse({
      instructorId,
      title: preview.title,
      description: preview.description,
      level: preview.level,
      categoryId: preview.categoryId,
      categoryIds: categories.map((category) => category.id),
      lessons: preview.lessons,
      assignments: preview.assignments,
    });
    setPending(null);

    if (!result.ok) {
      setMessage(result.message);
      if (result.course) setCreated({ ...result.course, complete: false });
      return;
    }

    setSaved(true);
    setMessage("This course was saved as a draft.");
    setCreated({ ...result.course, complete: true });
    setPreview(null);
    setBrief("");
    setLevel("");
    setCategoryId("");
  }

  function updatePreview(changes: Partial<Pick<PreviewFields, "title" | "description">>) {
    setPreview((current) => (current ? { ...current, ...changes } : current));
  }

  function updateLesson(index: number, field: "title" | "content", value: string) {
    setPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        lessons: current.lessons.map((lesson, lessonIndex) =>
          lessonIndex === index ? { ...lesson, [field]: value } : lesson,
        ),
      };
    });
  }

  function updateAssignment(index: number, field: "title" | "description", value: string) {
    setPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        assignments: current.assignments.map((assignment, assignmentIndex) =>
          assignmentIndex === index ? { ...assignment, [field]: value } : assignment,
        ),
      };
    });
  }

  function removeLesson(index: number) {
    setPreview((current) =>
      current
        ? { ...current, lessons: current.lessons.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    );
  }

  function removeAssignment(index: number) {
    setPreview((current) =>
      current
        ? {
            ...current,
            assignments: current.assignments.filter((_, itemIndex) => itemIndex !== index),
          }
        : current,
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="AI Course Builder"
        description="Describe a course. Review the outline, then save it as a draft."
        backTo="/instructor"
        backLabel="Instructor Dashboard"
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading categories…" /> : null}
      {!loading && !loadError ? (
        <form
          className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-none"
          onSubmit={handleGenerate}
        >
          <Field id="course-brief" label="Brief" hint="What should this course teach?">
            <Textarea
              id="course-brief"
              value={brief}
              maxLength={descriptionLimit}
              className="min-h-28"
              onChange={(event) => setBrief(event.target.value)}
              disabled={pending !== null || locked || preview !== null}
            />
          </Field>
          <Field
            id="course-level"
            label="Level"
            hint="Select the appropriate level for your course."
          >
            <Select
              key={level || "none"}
              {...(level ? { value: level } : {})}
              onValueChange={setLevel}
              disabled={pending !== null || locked || preview !== null}
            >
              <SelectTrigger id="course-level" className="w-full">
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
          <Field id="course-category" label="Category" hint="Optional." required={false}>
            <CategorySelect
              id="course-category"
              categories={categories}
              categoryId={categoryId}
              onChange={setCategoryId}
              disabled={pending !== null || locked || preview !== null}
            />
          </Field>
          <Button type="submit" disabled={pending !== null || locked || preview !== null}>
            {pending === "generate" ? "Generating…" : "Generate"}
          </Button>
        </form>
      ) : null}

      {preview ? (
        <section className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-none">
          <h2 className="text-base font-medium text-foreground">Preview</h2>
          <p className="text-sm text-muted-foreground">
            Level: {levelLabels[preview.level as (typeof courseLevels)[number]] ?? preview.level}.
            Edit the text before saving. This is still a draft until you submit it from My Courses.
          </p>
          <Field id="preview-title" label="Title" hint="This will be the name of your course.">
            <Input
              id="preview-title"
              value={preview.title}
              onChange={(event) => updatePreview({ title: event.target.value })}
              disabled={pending !== null || locked}
            />
          </Field>
          <Field id="preview-description" label="Description" hint="Keep it clear and concise.">
            <div className="relative">
              <Textarea
                id="preview-description"
                value={preview.description}
                maxLength={descriptionLimit}
                className="min-h-28 pb-7"
                onChange={(event) => updatePreview({ description: event.target.value })}
                disabled={pending !== null || locked}
              />
              <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground">
                {preview.description.length}/{descriptionLimit}
              </span>
            </div>
          </Field>
          {preview.lessons.map((lesson, index) => (
            <div key={`lesson-${index}`} className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">Lesson {index + 1}</h3>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending !== null || locked}
                  onClick={() => removeLesson(index)}
                >
                  Remove lesson
                </Button>
              </div>
              <Field id={`lesson-title-${index}`} label="Title" hint="Lesson title.">
                <Input
                  id={`lesson-title-${index}`}
                  value={lesson.title}
                  onChange={(event) => updateLesson(index, "title", event.target.value)}
                  disabled={pending !== null || locked}
                />
              </Field>
              <Field id={`lesson-content-${index}`} label="Content" hint="Lesson draft.">
                <Textarea
                  id={`lesson-content-${index}`}
                  value={lesson.content}
                  className="min-h-24"
                  onChange={(event) => updateLesson(index, "content", event.target.value)}
                  disabled={pending !== null || locked}
                />
              </Field>
            </div>
          ))}
          {preview.assignments.map((assignment, index) => (
            <div key={`assignment-${index}`} className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">Assignment {index + 1}</h3>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending !== null || locked}
                  onClick={() => removeAssignment(index)}
                >
                  Remove assignment
                </Button>
              </div>
              <Field id={`assignment-title-${index}`} label="Title" hint="Assignment title.">
                <Input
                  id={`assignment-title-${index}`}
                  value={assignment.title}
                  onChange={(event) => updateAssignment(index, "title", event.target.value)}
                  disabled={pending !== null || locked}
                />
              </Field>
              <Field
                id={`assignment-description-${index}`}
                label="Description"
                hint="Assignment question."
              >
                <Textarea
                  id={`assignment-description-${index}`}
                  value={assignment.description}
                  className="min-h-24"
                  onChange={(event) => updateAssignment(index, "description", event.target.value)}
                  disabled={pending !== null || locked}
                />
              </Field>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending !== null || locked}
              onClick={() => setPreview(null)}
            >
              Discard preview
            </Button>
            <Button type="button" disabled={pending !== null || locked} onClick={handleSave}>
              {pending === "save" ? "Saving…" : "Save"}
            </Button>
          </div>
        </section>
      ) : null}

      <SaveNotice
        tone="instructor"
        saved={saved}
        message={message}
        onDismiss={() => {
          setSaved(false);
          setMessage("");
        }}
      />
      {created ? <CreatedCoursePanel course={created} complete={created.complete} /> : null}
    </div>
  );
}

export function CreatedCoursePanel({
  course,
  complete,
}: {
  course: { id: string; title: string };
  complete: boolean;
}) {
  const title = course.title.trim() || "Draft course";
  return (
    <RecordCard
      title={title}
      badge={<StatusBadge value="draft" />}
      description={
        complete
          ? "This course was saved as a draft. Submit it for approval from My Courses after you review the lessons."
          : "This draft was created. Saving stopped before every lesson and assignment was added. Finish it on the lesson and assignment screens. It is still a draft."
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/instructor/courses/$courseId/lessons" params={{ courseId: course.id }}>
            Lessons
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/instructor/courses/$courseId/assignments" params={{ courseId: course.id }}>
            Assignments
          </Link>
        </Button>
      </div>
    </RecordCard>
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
