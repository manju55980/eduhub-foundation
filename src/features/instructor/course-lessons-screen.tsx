import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Save } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { RecordList, pageFrameClass, recordGridClass } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { compareLessons, lessonDraft, type LessonText } from "./lesson-draft";
import {
  createLesson,
  getOwnedCourse,
  listCourseLessons,
  updateLesson,
  type CourseLesson,
  type OwnedCourse,
} from "./lessons-api";
import { SaveNotice } from "./save-notice";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function CourseLessonsScreen({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<OwnedCourse | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMissing(false);
    setLoadError("");
    setCourse(null);
    setLessons([]);
    setNotice(emptyNotice);

    Promise.all([getOwnedCourse(courseId), listCourseLessons(courseId)]).then(
      ([courseResult, lessonsResult]) => {
        if (!active) return;
        setLoading(false);
        if (!courseResult.ok) {
          setLoadError(courseResult.message);
          return;
        }
        if (!courseResult.course) {
          setMissing(true);
          return;
        }
        if (!lessonsResult.ok) {
          setCourse(courseResult.course);
          setLoadError(lessonsResult.message);
          return;
        }
        setCourse(courseResult.course);
        setLessons(lessonsResult.lessons);
      },
    );

    return () => {
      active = false;
    };
  }, [courseId]);

  const heading = course?.title ? course.title : "Lessons";

  return (
    <section className={pageFrameClass}>
      <PageHeader
        title={heading}
        backTo="/instructor/courses"
        backLabel="My Courses (including lessons)"
      />
      <SaveNotice
        tone="instructor"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading lessons…" /> : null}
      {missing ? <EmptyState message="This course is not available." /> : null}
      {course && !loadError && !loading ? (
        <>
          <CreateLessonForm
            courseId={course.id}
            onNotice={setNotice}
            onCreated={(lesson) =>
              setLessons((current) => [...current, lesson].sort(compareLessons))
            }
          />
          {lessons.length === 0 ? (
            <EmptyState message="This course has no lessons yet." />
          ) : (
            <RecordList className={recordGridClass}>
              {lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onNotice={setNotice}
                  onUpdated={(lessonId, text) =>
                    setLessons((current) =>
                      current.map((item) =>
                        item.id === lessonId
                          ? {
                              ...item,
                              title: text.title,
                              content: text.content,
                              videoUrl: text.videoUrl,
                            }
                          : item,
                      ),
                    )
                  }
                />
              ))}
            </RecordList>
          )}
        </>
      ) : null}
    </section>
  );
}

function CreateLessonForm({
  courseId,
  onNotice,
  onCreated,
}: {
  courseId: string;
  onNotice: (notice: Notice) => void;
  onCreated: (lesson: CourseLesson) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const draft = lessonDraft(title, content, videoUrl);
    if (!draft.ok) {
      onNotice({ saved: false, message: draft.message });
      return;
    }

    setBusy(true);
    const result = await createLesson(courseId, draft.lesson);
    setBusy(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    setTitle("");
    setContent("");
    setVideoUrl("");
    onCreated(result.lesson);
    onNotice({ saved: true, message: "This lesson was saved." });
  }

  return (
    <form
      className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-none"
      onSubmit={handleSubmit}
    >
      <LessonFields
        idPrefix="new-lesson"
        title={title}
        content={content}
        videoUrl={videoUrl}
        disabled={busy}
        onTitle={setTitle}
        onContent={setContent}
        onVideoUrl={setVideoUrl}
      />
      <Button type="submit" disabled={busy}>
        <Save />
        {busy ? "Saving…" : "Save lesson"}
      </Button>
    </form>
  );
}

function LessonCard({
  lesson,
  onNotice,
  onUpdated,
}: {
  lesson: CourseLesson;
  onNotice: (notice: Notice) => void;
  onUpdated: (lessonId: string, text: LessonText) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title ?? "");
  const [content, setContent] = useState(lesson.content ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const draft = lessonDraft(title, content, videoUrl);
    if (!draft.ok) {
      onNotice({ saved: false, message: draft.message });
      return;
    }

    setBusy(true);
    const result = await updateLesson(lesson.id, draft.lesson);
    setBusy(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    setTitle(draft.lesson.title);
    setContent(draft.lesson.content);
    setVideoUrl(draft.lesson.videoUrl ?? "");
    onUpdated(lesson.id, draft.lesson);
    onNotice({ saved: true, message: "This lesson was updated." });
  }

  return (
    <article className="flex h-full flex-col space-y-3 rounded-sm border border-border bg-card p-4 shadow-none">
      <h2 className="text-base font-medium text-foreground">{lesson.title ?? ""}</h2>
      <p className="text-sm text-muted-foreground">Order {lesson.orderIndex ?? ""}</p>
      {editing ? (
        <form className="mt-auto space-y-5" onSubmit={handleSubmit}>
          <LessonFields
            idPrefix={`lesson-${lesson.id}`}
            title={title}
            content={content}
            videoUrl={videoUrl}
            disabled={busy}
            onTitle={setTitle}
            onContent={setContent}
            onVideoUrl={setVideoUrl}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              <Save />
              {busy ? "Saving…" : "Save lesson"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="space-y-3 text-sm">
            <LessonFact label="Content" value={lesson.content ?? ""} />
            <LessonFact label="Video URL" value={lesson.videoUrl ?? ""} />
          </dl>
          <div className="mt-auto">
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </>
      )}
    </article>
  );
}

function LessonFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-foreground">{value}</dd>
    </div>
  );
}

function LessonFields({
  idPrefix,
  title,
  content,
  videoUrl,
  disabled,
  onTitle,
  onContent,
  onVideoUrl,
}: {
  idPrefix: string;
  title: string;
  content: string;
  videoUrl: string;
  disabled: boolean;
  onTitle: (value: string) => void;
  onContent: (value: string) => void;
  onVideoUrl: (value: string) => void;
}) {
  return (
    <>
      <Field
        id={`${idPrefix}-title`}
        label="Title"
        required
        hint="This will be the name of the lesson."
      >
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          disabled={disabled}
        />
      </Field>
      <Field id={`${idPrefix}-content`} label="Content" required hint="What the learner will read.">
        <Textarea
          id={`${idPrefix}-content`}
          value={content}
          className="min-h-28"
          onChange={(event) => onContent(event.target.value)}
          disabled={disabled}
        />
      </Field>
      <Field id={`${idPrefix}-video`} label="Video URL" hint="Optional.">
        <Input
          id={`${idPrefix}-video`}
          value={videoUrl}
          onChange={(event) => onVideoUrl(event.target.value)}
          disabled={disabled}
        />
      </Field>
    </>
  );
}

function Field({
  id,
  label,
  hint,
  required,
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
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
