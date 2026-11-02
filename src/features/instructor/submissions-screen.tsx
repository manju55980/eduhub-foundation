import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Save } from "lucide-react";

import { ChoiceButton, FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { MetaItem, MetaList, PageSection, RecordList, panelClass, recordGridClass } from "@/components/app-shell/record-card";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { gradeDraft, isGradeScore } from "./grade-draft";
import { SaveNotice } from "./save-notice";
import { listInstructorSubmissions, saveGrade } from "./submissions-api";
import { submissionViews, type GradableSubmission } from "./submissions";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function SubmissionsScreen() {
  const [submissions, setSubmissions] = useState<GradableSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    listInstructorSubmissions().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setSubmissions(result.submissions);
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = submissions.filter((submission) =>
    matchesQuery(query, [
      submission.assignmentTitle,
      submission.courseTitle,
      submission.studentName,
    ]),
  );

  return (
    <PageSection>
      <PageHeader
        title="Submissions"
        description="Review submitted work and record a grade."
      />
      <SaveNotice
        tone="instructor"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading submissions…" /> : null}
      {!loading && !loadError && submissions.length > 0 ? (
        <FilterToolbar
          id="submission-search"
          value={query}
          placeholder="Search by assignment, course, or student..."
          onChange={setQuery}
        />
      ) : null}
      {!loading && !loadError && submissions.length > 0 && visible.length === 0 ? (
        <EmptyState message="No submissions match this search." />
      ) : null}
      {!loading && !loadError && !(submissions.length > 0 && visible.length === 0) ? (
        <SubmissionViews
          submissions={visible}
          onNotice={setNotice}
          onGraded={(submissionId, grade) =>
            setSubmissions((current) =>
              current.map((item) =>
                item.id === submissionId
                  ? {
                      ...item,
                      grade: grade.grade,
                      feedback: grade.feedback,
                      status: "graded",
                    }
                  : item,
              ),
            )
          }
        />
      ) : null}
    </PageSection>
  );
}

function SubmissionViews({
  submissions,
  onNotice,
  onGraded,
}: {
  submissions: GradableSubmission[];
  onNotice: (notice: Notice) => void;
  onGraded: (submissionId: string, grade: { grade: string; feedback: string | null }) => void;
}) {
  const views = submissionViews(submissions);

  const [tab, setTab] = useState<"to-grade" | "graded">("to-grade");
  const tabs = [
    { value: "to-grade" as const, label: "To Grade" },
    { value: "graded" as const, label: "Graded" },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const active = tab === item.value;
          return (
            <ChoiceButton
              key={item.value}
              pressed={active}
              role="tab"
              aria-selected={active}
              data-state={active ? "active" : "inactive"}
              onMouseDown={() => setTab(item.value)}
              onClick={() => setTab(item.value)}
            >
              {item.label}
            </ChoiceButton>
          );
        })}
      </div>
      <div className="space-y-3">
        <SubmissionList
          submissions={tab === "to-grade" ? views.toGrade : views.graded}
          emptyMessage={tab === "to-grade" ? "No submissions to grade." : "No graded submissions."}
          onNotice={onNotice}
          onGraded={onGraded}
        />
      </div>
    </div>
  );
}

function SubmissionList({
  submissions,
  emptyMessage,
  onNotice,
  onGraded,
}: {
  submissions: GradableSubmission[];
  emptyMessage: string;
  onNotice: (notice: Notice) => void;
  onGraded: (submissionId: string, grade: { grade: string; feedback: string | null }) => void;
}) {
  if (submissions.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <RecordList className={recordGridClass}>
      {submissions.map((submission) => (
        <SubmissionCard
          key={submission.id}
          submission={submission}
          onNotice={onNotice}
          onGraded={(grade) => onGraded(submission.id, grade)}
        />
      ))}
    </RecordList>
  );
}

function SubmissionCard({
  submission,
  onNotice,
  onGraded,
}: {
  submission: GradableSubmission;
  onNotice: (notice: Notice) => void;
  onGraded: (grade: { grade: string; feedback: string | null }) => void;
}) {
  const [grade, setGrade] = useState(submission.grade ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const draft = gradeDraft(grade, feedback);
    if (!draft.ok) {
      onNotice({ saved: false, message: draft.message });
      return;
    }

    setPending(true);
    const result = await saveGrade(submission.id, draft.grade);
    setPending(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    setGrade(draft.grade.grade);
    setFeedback(draft.grade.feedback ?? "");
    onGraded(draft.grade);
    onNotice({ saved: true, message: "This submission was graded." });
  }

  return (
    <article className={cn(panelClass, "flex h-full flex-col space-y-3 p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">
          {submission.assignmentTitle ?? ""}
        </h2>
        <StatusBadge value={submission.status} />
      </div>
      <MetaList stacked>
        <MetaItem label="Course" value={submission.courseTitle ?? ""} />
        <MetaItem label="Student" value={submission.studentName ?? ""} />
        <MetaItem label="Created" value={formatCreatedAt(submission.createdAt)} />
        <MetaItem label="Submission" value={submission.contentUrl ?? ""} />
      </MetaList>
      <form className="mt-auto space-y-4" onSubmit={handleSubmit}>
        <Field
          id={`grade-${submission.id}`}
          label="Grade"
          required
          hint="Whole number from 1 to 10."
        >
          <Input
            id={`grade-${submission.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            step={1}
            value={grade}
            onChange={(event) => {
              const next = event.target.value.trim();
              if (next === "" || isGradeScore(next)) {
                setGrade(next);
                return;
              }
              event.target.value = grade;
            }}
            disabled={pending}
          />
        </Field>
        <Field id={`feedback-${submission.id}`} label="Feedback" hint="Optional.">
          <Textarea
            id={`feedback-${submission.id}`}
            value={feedback}
            className="min-h-28"
            onChange={(event) => setFeedback(event.target.value)}
            disabled={pending}
          />
        </Field>
        <Button type="submit" disabled={pending}>
          <Save />
          {pending ? "Saving…" : "Save grade"}
        </Button>
      </form>
    </article>
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

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
