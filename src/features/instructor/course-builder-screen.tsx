import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { CourseListing, InstructorCourseLinks } from "@/features/courses/course-listing";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listCategories } from "@/features/categories/categories-api";
import { CategorySelect } from "@/features/categories/category-select";
import type { CourseCategory } from "@/features/categories/category-name";
import { SaveNotice } from "@/features/instructor/save-notice";
import {
  descriptionLimit,
  maxAssignments,
  maxLessons,
  preferenceLimit,
} from "../../../supabase/functions/_shared/course-preview.ts";

import { toDateTimeLocal } from "./assignment-draft";
import { progressiveDueDates } from "./assignment-due-dates";
import { generateCoursePreview, saveGeneratedCourse } from "./course-builder-api";
import { courseLevels } from "./course-draft";

const levelLabels: Record<(typeof courseLevels)[number], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type SuggestedVideo = {
  title: string;
  channel: string;
  description: string;
  url: string;
};

type PreviewFields = {
  level: string;
  categoryId: string;
  title: string;
  description: string;
  lessons: Array<{ title: string; content: string; videoUrl: string }>;
  assignments: Array<{ title: string; description: string; dueDate: string }>;
  videos: SuggestedVideo[];
  videoMessage: string;
};

type CreatedDraft = {
  id: string;
  title: string;
  complete: boolean;
};

export function CourseBuilderScreen({ instructorId }: { instructorId: string }) {
  const [brief, setBrief] = useState("");
  const [level, setLevel] = useState("");
  const [lessonCount, setLessonCount] = useState("");
  const [assignmentCount, setAssignmentCount] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [goals, setGoals] = useState("");
  const [projects, setProjects] = useState("");
  const [resources, setResources] = useState("");
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
    const result = await generateCoursePreview({
      brief,
      level,
      lessonCount,
      assignmentCount,
      difficulty,
      goals,
      projects,
      resources,
    });
    setPending(null);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    if (created?.complete) setCreated(null);
    const dueDates = progressiveDueDates(
      result.preview.lessons.length,
      result.preview.assignments.length,
      new Date(),
    );
    setPreview({
      level,
      categoryId,
      title: result.preview.title,
      description: result.preview.description,
      lessons: result.preview.lessons.map((lesson) => ({
        title: lesson.title,
        content: lesson.content,
        videoUrl: "",
      })),
      videos: result.videos,
      videoMessage: result.videoMessage,
      assignments: result.preview.assignments.map((assignment, index) => ({
        title: assignment.title,
        description: assignment.description,
        dueDate: toDateTimeLocal(dueDates[index] ?? null),
      })),
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
    setLessonCount("");
    setAssignmentCount("");
    setDifficulty("");
    setGoals("");
    setProjects("");
    setResources("");
    setCategoryId("");
  }

  function updatePreview(changes: Partial<Pick<PreviewFields, "title" | "description">>) {
    setPreview((current) => (current ? { ...current, ...changes } : current));
  }

  function updateLesson(index: number, field: "title" | "content" | "videoUrl", value: string) {
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

  function updateAssignment(
    index: number,
    field: "title" | "description" | "dueDate",
    value: string,
  ) {
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
            <select
              id="course-level"
              className="flex h-9 w-full min-w-0 max-w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={level}
              disabled={pending !== null || locked || preview !== null}
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
          <Field
            id="lesson-count"
            label="Lessons"
            hint="How many lessons to generate, from 1 to 6."
          >
            <Input
              id="lesson-count"
              type="number"
              min={1}
              max={maxLessons}
              step={1}
              value={lessonCount}
              onChange={(event) => setLessonCount(event.target.value)}
              disabled={pending !== null || locked || preview !== null}
            />
          </Field>
          <Field
            id="assignment-count"
            label="Assignments"
            hint="How many assignments to generate, from 0 to 4."
          >
            <Input
              id="assignment-count"
              type="number"
              min={0}
              max={maxAssignments}
              step={1}
              value={assignmentCount}
              onChange={(event) => setAssignmentCount(event.target.value)}
              disabled={pending !== null || locked || preview !== null}
            />
          </Field>
          <Field
            id="course-difficulty"
            label="Difficulty"
            hint="Optional. A note beyond the course level, such as a slower pace."
            required={false}
          >
            <Input
              id="course-difficulty"
              value={difficulty}
              maxLength={120}
              onChange={(event) => setDifficulty(event.target.value)}
              disabled={pending !== null || locked || preview !== null}
            />
          </Field>
          <Field
            id="learning-goals"
            label="Learning goals"
            hint="Optional. What a learner should be able to do by the end."
            required={false}
          >
            <Textarea
              id="learning-goals"
              value={goals}
              maxLength={preferenceLimit}
              onChange={(event) => setGoals(event.target.value)}
              disabled={pending !== null || locked || preview !== null}
            />
          </Field>
          <Field
            id="course-projects"
            label="Projects"
            hint="Optional. A project the lessons and assignments should build toward."
            required={false}
          >
            <Textarea
              id="course-projects"
              value={projects}
              maxLength={preferenceLimit}
              onChange={(event) => setProjects(event.target.value)}
              disabled={pending !== null || locked || preview !== null}
            />
          </Field>
          <Field
            id="resource-preferences"
            label="Resource preferences"
            hint="Optional. Topics or formats to prefer when suggesting videos."
            required={false}
          >
            <Textarea
              id="resource-preferences"
              value={resources}
              maxLength={preferenceLimit}
              onChange={(event) => setResources(event.target.value)}
              disabled={pending !== null || locked || preview !== null}
            />
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
          <div className="space-y-3 border-t border-border pt-3">
            <h3 className="text-sm font-medium text-foreground">Suggested videos</h3>
            {preview.videoMessage ? (
              <p className="text-sm text-muted-foreground">{preview.videoMessage}</p>
            ) : null}
            {preview.videos.length > 0 ? (
              <ul className="space-y-3">
                {preview.videos.map((video) => (
                  <li key={video.url} className="space-y-1">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground underline"
                    >
                      {video.title}
                    </a>
                    <p className="text-xs text-muted-foreground">{video.channel}</p>
                    {video.description ? (
                      <p className="text-sm text-muted-foreground">{video.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {preview.lessons.map((lesson, index) => {
            const selectedVideo = preview.videos.find((video) => video.url === lesson.videoUrl);
            return (
              <div key={`lesson-${index}`} className="space-y-3 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="min-w-0 text-sm font-medium text-foreground">
                    Lesson {index + 1}
                  </h3>
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
                <Field
                  id={`lesson-content-${index}`}
                  label="Content"
                  hint="Learning objectives, explanation, example, practice, and further reading. Edit any of it."
                >
                  <Textarea
                    id={`lesson-content-${index}`}
                    value={lesson.content}
                    className="min-h-40"
                    onChange={(event) => updateLesson(index, "content", event.target.value)}
                    disabled={pending !== null || locked}
                  />
                </Field>
                <Field
                  id={`lesson-video-${index}`}
                  label="Video"
                  hint="Choose a suggestion, paste a different URL, or clear it to remove the video."
                  required={false}
                >
                  <select
                    id={`lesson-video-${index}`}
                    className="flex h-9 w-full min-w-0 max-w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedVideo ? lesson.videoUrl : ""}
                    onChange={(event) => updateLesson(index, "videoUrl", event.target.value)}
                    disabled={pending !== null || locked}
                  >
                    <option value="">No video</option>
                    {preview.videos.map((video) => (
                      <option key={video.url} value={video.url}>
                        {video.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  id={`lesson-video-url-${index}`}
                  label="Video URL"
                  hint="This is the URL saved on the lesson. A suggestion fills it in."
                  required={false}
                >
                  <Input
                    id={`lesson-video-url-${index}`}
                    type="url"
                    value={lesson.videoUrl}
                    onChange={(event) => updateLesson(index, "videoUrl", event.target.value)}
                    disabled={pending !== null || locked}
                  />
                </Field>
                {selectedVideo ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedVideo.channel}
                    {selectedVideo.description ? `. ${selectedVideo.description}` : ""}
                  </p>
                ) : null}
              </div>
            );
          })}
          {preview.assignments.map((assignment, index) => (
            <div key={`assignment-${index}`} className="space-y-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 text-sm font-medium text-foreground">
                  Assignment {index + 1}
                </h3>
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
              <Field
                id={`assignment-due-${index}`}
                label="Due date"
                hint="Set from the lesson order. A date you change is the one that is saved. Leave it blank to keep that default."
              >
                <Input
                  id={`assignment-due-${index}`}
                  type="datetime-local"
                  value={assignment.dueDate}
                  onChange={(event) => updateAssignment(index, "dueDate", event.target.value)}
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
    <CourseListing
      role="instructor"
      from="builder"
      courseId={course.id}
      title={title}
      badge={<StatusBadge value="draft" />}
      description={
        complete
          ? "This course was saved as a draft. Submit it for approval from My Courses after you review the lessons."
          : "This draft was created. Saving stopped before every lesson and assignment was added. Finish it on the lesson and assignment screens. It is still a draft."
      }
      actions={<InstructorCourseLinks courseId={course.id} />}
    />
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
