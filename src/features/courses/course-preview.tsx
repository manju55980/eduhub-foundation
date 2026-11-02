import { useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LessonProgressSummary } from "@/features/student/lesson-progress";
import { externalVideoUrl } from "@/features/student/video-url";
import { listCompletedLessonIds } from "@/features/notifications/notifications-api";

import { getCourseDetails } from "./course-details-api";
import { courseLevelLabel } from "./course-details";

export type CoursePreviewLesson = {
  id: string;
  title: string | null;
  content?: string | null;
  videoUrl?: string | null;
  completed?: boolean;
};

export type CoursePreviewProgress = {
  completed: number;
  total: number;
  percent: number;
};

export function CoursePreview({
  courseId,
  title,
  description,
  level,
  categoryName,
  instructorName,
  progress,
  lessons,
  role,
  studentId,
  enrolled = false,
  actions,
}: {
  courseId: string;
  title: string;
  description?: string | null | undefined;
  level?: string | undefined;
  categoryName?: string | null | undefined;
  instructorName?: string | null | undefined;
  progress?: CoursePreviewProgress | null | undefined;
  lessons?: CoursePreviewLesson[] | undefined;
  role: "student" | "instructor" | "admin";
  studentId?: string | undefined;
  enrolled?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedLessons, setLoadedLessons] = useState<CoursePreviewLesson[] | null>(null);
  const [loadedProgress, setLoadedProgress] = useState<CoursePreviewProgress | null>(null);
  const [loadedInstructor, setLoadedInstructor] = useState<string | null>(null);
  const [loadedDescription, setLoadedDescription] = useState<string | null>(null);
  const [loadedCategory, setLoadedCategory] = useState<string | null>(null);
  const [loadedLevel, setLoadedLevel] = useState<string | null>(null);
  const [loadedEnrolled, setLoadedEnrolled] = useState(enrolled);

  const shownLessons = lessons ?? loadedLessons;
  const shownProgress = progress ?? loadedProgress;
  const shownInstructor = instructorName ?? loadedInstructor;
  const shownDescription = description ?? loadedDescription ?? "";
  const shownCategory = categoryName ?? loadedCategory ?? "";
  const shownLevel = courseLevelLabel(level ?? loadedLevel ?? "");
  const studentEnrolled = enrolled || loadedEnrolled;
  const showOutline = role !== "student" || studentEnrolled;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next || lessons) return;
    setLoading(true);
    setError("");
    void loadPreview(courseId, role, studentId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLoadedLessons(result.lessons);
      setLoadedProgress(result.progress);
      setLoadedInstructor(result.instructorName);
      setLoadedDescription(result.description);
      setLoadedCategory(result.categoryName);
      setLoadedLevel(result.level);
      setLoadedEnrolled(result.enrolled);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto px-0">
          Quick preview
          <ArrowRight />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl gap-5 p-4 sm:p-6">
        <DialogHeader className="space-y-2 pr-8 text-left">
          <DialogTitle className="text-xl font-semibold text-foreground [overflow-wrap:anywhere]">
            {title || "Untitled course"}
          </DialogTitle>
          {shownDescription ? (
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {shownDescription}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Course preview</DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-foreground">
          {shownCategory ? <span>{shownCategory}</span> : null}
          {shownLevel ? <span>{shownLevel}</span> : null}
          {role !== "student" && shownInstructor ? <span>By {shownInstructor}</span> : null}
        </div>
        {loading ? <LoadingState message="Loading preview…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error ? (
          <div className="space-y-4">
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Overview</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                {shownDescription}
              </p>
            </section>
            {studentEnrolled && shownProgress ? (
              <div className="rounded-xl border border-border bg-card p-3">
                <LessonProgressSummary
                  completed={shownProgress.completed}
                  total={shownProgress.total}
                  progress={shownProgress.percent}
                />
              </div>
            ) : null}
            {showOutline ? (
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Lesson outline</h3>
                {shownLessons && shownLessons.length > 0 ? (
                  <ol className="space-y-3">
                    {shownLessons.map((lesson) => {
                      const video = externalVideoUrl(lesson.videoUrl);
                      return (
                        <li key={lesson.id} className="space-y-1 text-sm text-foreground">
                          <p className="font-medium [overflow-wrap:anywhere]">
                            {lesson.title ?? ""}
                            {lesson.completed ? " · Completed" : ""}
                          </p>
                          {lesson.content ? (
                            <p className="whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
                              {lesson.content}
                            </p>
                          ) : null}
                          {video ? (
                            <a
                              href={video}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [overflow-wrap:anywhere]"
                            >
                              {video}
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>
                )}
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">
                Lessons are available after you enroll.
              </p>
            )}
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">{actions}</div>
          <DialogClose asChild>
            <Button type="button" variant="link" className="h-auto px-0">
              Close preview
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function loadPreview(
  courseId: string,
  role: "student" | "instructor" | "admin",
  studentId: string | undefined,
) {
  const [details, completions] = await Promise.all([
    getCourseDetails(courseId, {
      includeLessons: true,
      includeInstructor: role !== "student",
      ...(studentId ? { studentId } : {}),
    }),
    studentId ? listCompletedLessonIds(studentId) : Promise.resolve(null),
  ]);
  if (!details.ok) return details;
  if (completions && !completions.ok) return completions;

  const completedIds = new Set(completions?.lessonIds ?? []);
  const lessons = (details.course.lessons ?? []).map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    completed: completedIds.has(lesson.id),
  }));
  const enrollment = details.course.enrollment;
  const completed = lessons.filter((lesson) => lesson.completed).length;

  return {
    ok: true as const,
    description: details.course.description,
    categoryName: details.course.categoryName,
    level: details.course.level,
    instructorName: details.course.instructorName,
    enrolled: enrollment !== null,
    lessons,
    progress: enrollment
      ? { completed, total: lessons.length, percent: enrollment.progress }
      : null,
  };
}
