import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Save } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { RecordList } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { gradeDraft } from "./grade-draft";
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

  return (
    <section className="max-w-6xl space-y-4">
      <PageHeader title="Submissions (grading)" />
      <SaveNotice
        tone="instructor"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading submissions…" /> : null}
      {!loading && !loadError ? (
        <SubmissionViews
          submissions={submissions}
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
    </section>
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

  return (
    <Tabs defaultValue="to-grade" className="space-y-4">
      <TabsList>
        <TabsTrigger value="to-grade">To Grade</TabsTrigger>
        <TabsTrigger value="graded">Graded</TabsTrigger>
      </TabsList>
      <TabsContent value="to-grade" className="space-y-3">
        <SubmissionList
          submissions={views.toGrade}
          emptyMessage="No submissions to grade."
          onNotice={onNotice}
          onGraded={onGraded}
        />
      </TabsContent>
      <TabsContent value="graded" className="space-y-3">
        <SubmissionList
          submissions={views.graded}
          emptyMessage="No graded submissions."
          onNotice={onNotice}
          onGraded={onGraded}
        />
      </TabsContent>
    </Tabs>
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
    <RecordList className="sm:grid-cols-2 lg:grid-cols-3">
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
    <article className="flex h-full flex-col space-y-3 rounded-sm border border-border bg-card p-4 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">
          {submission.assignmentTitle ?? ""}
        </h2>
        <StatusBadge value={submission.status} />
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <MetaItem label="Course" value={submission.courseTitle ?? ""} />
        <MetaItem label="Student" value={submission.studentName ?? ""} />
        <MetaItem label="Created" value={formatCreatedAt(submission.createdAt)} />
      </dl>
      <MetaItem label="Submission" value={submission.contentUrl ?? ""} />
      <form className="mt-auto space-y-5" onSubmit={handleSubmit}>
        <Field
          id={`grade-${submission.id}`}
          label="Grade"
          required
          hint="Plain text. No grading scale is defined."
        >
          <Input
            id={`grade-${submission.id}`}
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-foreground">{value}</dd>
    </div>
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
