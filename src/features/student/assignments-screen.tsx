import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import {
  MetaItem,
  MetaList,
  PageSection,
  RecordCard,
  RecordList,
  recordGridClass,
} from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SaveNotice } from "@/features/instructor/save-notice";

import { listStudentAssignments, submitAssignment } from "./assignments-api";
import { submissionDraft, type StudentAssignment } from "./submission";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function AssignmentsScreen({ studentId }: { studentId: string }) {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    listStudentAssignments(studentId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setAssignments(result.assignments);
    });
    return () => {
      active = false;
    };
  }, [studentId]);

  const visible = assignments.filter((assignment) =>
    matchesQuery(query, [assignment.title, assignment.courseTitle]),
  );

  return (
    <PageSection>
      <PageHeader title="Assignments" description="Work for the courses you have joined." />
      <SaveNotice
        tone="student"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading assignments…" /> : null}
      {!loading && !loadError && assignments.length === 0 ? (
        <EmptyState message="You have no assignments.">
          <Button asChild>
            <Link to="/student/courses">Browse Courses</Link>
          </Button>
        </EmptyState>
      ) : null}
      {!loading && !loadError && assignments.length > 0 ? (
        <FilterToolbar
          id="assignment-search"
          value={query}
          placeholder="Search by assignment or course..."
          onChange={setQuery}
        />
      ) : null}
      {!loading && !loadError && assignments.length > 0 && visible.length === 0 ? (
        <EmptyState message="No assignments match this search." />
      ) : null}
      {!loading && !loadError && visible.length > 0 ? (
        <RecordList className={recordGridClass}>
          {visible.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              studentId={studentId}
              onNotice={setNotice}
              onSubmitted={(contentUrl) =>
                setAssignments((current) =>
                  current.map((item) =>
                    item.id === assignment.id
                      ? { ...item, submission: { contentUrl, status: "submitted" } }
                      : item,
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

function AssignmentCard({
  assignment,
  studentId,
  onNotice,
  onSubmitted,
}: {
  assignment: StudentAssignment;
  studentId: string;
  onNotice: (notice: Notice) => void;
  onSubmitted: (contentUrl: string) => void;
}) {
  return (
    <RecordCard
      className="flex h-full flex-col"
      title={assignment.title ?? ""}
      description={assignment.description}
    >
      <MetaList stacked>
        <MetaItem label="Course" value={assignment.courseTitle ?? ""} />
        <MetaItem label="Due date" value={formatDueAt(assignment.dueDate)} />
        <MetaItem label="Created" value={formatCreatedAt(assignment.createdAt)} />
      </MetaList>
      <div className="mt-auto">
        {assignment.submission ? (
          <MetaList stacked>
            <MetaItem label="Submission" value={assignment.submission.contentUrl ?? ""} />
            <MetaItem label="Status">
              <StatusBadge value={assignment.submission.status} />
            </MetaItem>
          </MetaList>
        ) : (
          <SubmitForm
            assignmentId={assignment.id}
            studentId={studentId}
            onNotice={onNotice}
            onSubmitted={onSubmitted}
          />
        )}
      </div>
    </RecordCard>
  );
}

function SubmitForm({
  assignmentId,
  studentId,
  onNotice,
  onSubmitted,
}: {
  assignmentId: string;
  studentId: string;
  onNotice: (notice: Notice) => void;
  onSubmitted: (contentUrl: string) => void;
}) {
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const draft = submissionDraft(content);
    if (!draft.ok) {
      onNotice({ saved: false, message: draft.message });
      return;
    }

    setPending(true);
    const result = await submitAssignment(studentId, assignmentId, draft.contentUrl);
    setPending(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    onSubmitted(draft.contentUrl);
    onNotice({ saved: true, message: "This assignment was submitted." });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field id={`submission-${assignmentId}`} label="Submission" hint="Text or a link.">
        <Textarea
          id={`submission-${assignmentId}`}
          value={content}
          className="min-h-28"
          onChange={(event) => setContent(event.target.value)}
          disabled={pending}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      {children}
      <p className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        {hint}
      </p>
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
