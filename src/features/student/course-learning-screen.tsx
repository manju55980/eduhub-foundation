import { useEffect, useState } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";

import {
  loadCourseLearning,
  type LearningCourse,
  type LearningLesson,
} from "./course-learning-api";
import { StudyCompanionCard } from "./study-companion-card";
import { externalVideoUrl } from "./video-url";

export function CourseLearningScreen({
  courseId,
  studentId,
}: {
  courseId: string;
  studentId: string;
}) {
  const [course, setCourse] = useState<LearningCourse | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [lessons, setLessons] = useState<LearningLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMissing(false);
    setLoadError("");
    setCourse(null);
    setEnrolled(false);
    setLessons([]);

    loadCourseLearning(courseId, studentId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      if (!result.course) {
        setMissing(true);
        return;
      }
      setCourse(result.course);
      if (!result.enrolled) return;
      setEnrolled(true);
      setLessons(result.lessons);
    });

    return () => {
      active = false;
    };
  }, [courseId, studentId]);

  const heading = course?.title ? course.title : "Lessons";

  return (
    <section className="max-w-5xl space-y-4">
      <PageHeader title={heading} backTo="/student/courses" backLabel="Browse Courses" />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading lessons…" /> : null}
      {missing ? <EmptyState message="This course is not available." /> : null}
      {course && !enrolled && !loading && !loadError ? (
        <EmptyState message="Lessons are hidden until you enroll." />
      ) : null}
      {enrolled && !loadError && !loading && lessons.length === 0 ? (
        <EmptyState message="This course has no lessons yet." />
      ) : null}
      {enrolled && !loadError
        ? lessons.map((lesson) => (
            <article
              key={lesson.id}
              className="space-y-3 rounded-sm border border-border bg-card p-4 shadow-none"
            >
              <h2 className="text-base font-medium text-foreground">{lesson.title ?? ""}</h2>
              <dl className="space-y-3 text-sm">
                <LessonFact label="Content" value={lesson.content ?? ""} />
                <VideoUrlFact value={lesson.videoUrl} />
              </dl>
            </article>
          ))
        : null}
      {enrolled && !loadError && !loading ? (
        <StudyCompanionCard courseId={courseId} lessons={lessons} />
      ) : null}
    </section>
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

function VideoUrlFact({ value }: { value: string | null }) {
  const url = externalVideoUrl(value);
  if (!url) return null;

  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">Video URL</dt>
      <dd className="text-foreground">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline [overflow-wrap:anywhere]"
        >
          {url}
        </a>
      </dd>
    </div>
  );
}
