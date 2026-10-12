import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import {
  MetaItem,
  MetaList,
  PageSection,
  RecordCard,
  RecordList,
} from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";

import { listStudentGrades } from "./grades-api";
import type { StudentGrade } from "./grades";

export function GradesScreen({ studentId }: { studentId: string }) {
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    listStudentGrades(studentId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setGrades(result.grades);
    });
    return () => {
      active = false;
    };
  }, [studentId]);

  return (
    <PageSection>
      <PageHeader title="My Grades" />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading grades…" /> : null}
      {!loading && !loadError && grades.length === 0 ? (
        <EmptyState message="You have no grades yet.">
          <Button asChild>
            <Link to="/student/assignments">Assignments</Link>
          </Button>
        </EmptyState>
      ) : null}
      {!loading && !loadError && grades.length > 0 ? (
        <RecordList className="sm:grid-cols-2 lg:grid-cols-3">
          {grades.map((grade) => (
            <GradeCard key={grade.id} grade={grade} />
          ))}
        </RecordList>
      ) : null}
    </PageSection>
  );
}

function GradeCard({ grade }: { grade: StudentGrade }) {
  return (
    <RecordCard
      className="flex h-full flex-col"
      title={grade.assignmentTitle ?? ""}
      badge={<StatusBadge value="graded" />}
      description={grade.description}
    >
      <MetaList stacked>
        <MetaItem label="Course" value={grade.courseTitle ?? ""} />
        <MetaItem label="Due date" value={formatDueAt(grade.dueDate)} />
        <MetaItem label="Created" value={formatCreatedAt(grade.createdAt)} />
      </MetaList>
      <div className="mt-auto">
        <MetaList stacked>
          <MetaItem label="Submission" value={grade.contentUrl ?? ""} />
          <MetaItem label="Grade" value={grade.grade ?? ""} />
          <MetaItem label="Feedback" value={grade.feedback ?? ""} />
        </MetaList>
      </div>
    </RecordCard>
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

function formatDueAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
