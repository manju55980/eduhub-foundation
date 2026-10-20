import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";
import { CertificateIssued } from "@/features/notifications/notification-list";
import {
  loadLessonProgress,
  markLessonComplete,
  shownCertificate,
} from "@/features/notifications/notifications-api";

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
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [enrollmentStatus, setEnrollmentStatus] = useState("active");
  const [certificateIssuedAt, setCertificateIssuedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingLessonId, setSavingLessonId] = useState("");
  const [progressLoaded, setProgressLoaded] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMissing(false);
    setLoadError("");
    setCourse(null);
    setEnrolled(false);
    setLessons([]);
    setCompletedLessonIds([]);
    setEnrollmentStatus("active");
    setCertificateIssuedAt(null);
    setProgressError("");
    setNotice("");
    setProgressLoaded(false);

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
      void loadProgress();
    });

    function loadProgress() {
      return loadLessonProgress(courseId, studentId).then((result) => {
        if (!active) return;
        if (!result.ok) {
          setProgressError(result.message);
          return;
        }
        if (!result.enrolled) return;
        setEnrollmentStatus(result.enrollmentStatus);
        setCompletedLessonIds(result.completedLessonIds);
        setCertificateIssuedAt(result.certificateIssuedAt);
        setProgressLoaded(true);
      });
    }

    return () => {
      active = false;
    };
  }, [courseId, studentId]);

  async function markComplete(lessonId: string) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingLessonId(lessonId);
    setActionError("");
    try {
      const result = await markLessonComplete(studentId, lessonId);
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      setCompletedLessonIds((current) => [...new Set([...current, lessonId])]);
      setNotice("This lesson is complete.");
      const progress = await loadLessonProgress(courseId, studentId);
      if (!progress.ok) {
        setProgressError(progress.message);
        return;
      }
      if (!progress.enrolled) return;
      setEnrollmentStatus(progress.enrollmentStatus);
      setCompletedLessonIds(progress.completedLessonIds);
      setCertificateIssuedAt(progress.certificateIssuedAt);
      setProgressLoaded(true);
    } finally {
      savingRef.current = false;
      setSavingLessonId("");
    }
  }

  const heading = course?.title ? course.title : "Lessons";
  const certificate = shownCertificate(
    enrollmentStatus,
    "this-enrollment",
    certificateIssuedAt
      ? [{ enrollmentId: "this-enrollment", courseId, issuedAt: certificateIssuedAt }]
      : [],
  );
  const completedIds = new Set(completedLessonIds);

  return (
    <section className="max-w-5xl space-y-4">
      <PageHeader title={heading} backTo="/student/courses" backLabel="Browse Courses" />
      {loadError ? <ErrorState message={loadError} /> : null}
      {notice ? (
        <SaveNotice saved message={notice} tone="student" onDismiss={() => setNotice("")} />
      ) : null}
      {progressError ? <ErrorState message={progressError} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {loading ? <LoadingState message="Loading lessons…" /> : null}
      {missing ? <EmptyState message="This course is not available." /> : null}
      {course && !enrolled && !loading && !loadError ? (
        <EmptyState message="Lessons are hidden until you enroll." />
      ) : null}
      {enrolled && certificate && course ? (
        <CertificateIssued title={course.title ?? ""} issuedAt={certificate.issuedAt} />
      ) : null}
      {enrolled && !loadError && !loading && lessons.length === 0 ? (
        <EmptyState message="This course has no lessons yet." />
      ) : null}
      {enrolled && !loadError
        ? lessons.map((lesson) => {
            const completed = completedIds.has(lesson.id);
            return (
              <article
                key={lesson.id}
                className="space-y-3 rounded-sm border border-border bg-card p-4 shadow-none"
              >
                <h2 className="text-base font-medium text-foreground">{lesson.title ?? ""}</h2>
                <dl className="space-y-3 text-sm">
                  <LessonFact label="Content" value={lesson.content ?? ""} />
                  <VideoUrlFact value={lesson.videoUrl} />
                </dl>
                {completed ? <p>Completed</p> : null}
                {progressLoaded && !progressError && !completed ? (
                  <Button
                    type="button"
                    disabled={savingLessonId === lesson.id}
                    onClick={() => void markComplete(lesson.id)}
                  >
                    {savingLessonId === lesson.id ? "Saving…" : "Mark complete"}
                  </Button>
                ) : null}
              </article>
            );
          })
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
