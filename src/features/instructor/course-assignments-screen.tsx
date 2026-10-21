import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Save } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { pageFrameClass } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { assignmentDraft, toDateTimeLocal, type AssignmentText } from "./assignment-draft";
import { compareCoursesNewestFirst } from "./course-update";
import {
  createAssignment,
  listCourseAssignments,
  updateAssignment,
  type CourseAssignment,
} from "./assignments-api";
import { getOwnedCourse, type OwnedCourse } from "./lessons-api";
import { SaveNotice } from "./save-notice";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function CourseAssignmentsScreen({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<OwnedCourse | null>(null);
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
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
    setAssignments([]);
    setNotice(emptyNotice);

    Promise.all([getOwnedCourse(courseId), listCourseAssignments(courseId)]).then(
      ([courseResult, assignmentsResult]) => {
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
        if (!assignmentsResult.ok) {
          setCourse(courseResult.course);
          setLoadError(assignmentsResult.message);
          return;
        }
        setCourse(courseResult.course);
        setAssignments(assignmentsResult.assignments);
      },
    );

    return () => {
      active = false;
    };
  }, [courseId]);

  const heading = course?.title ? course.title : "Assignments";

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
      {loading ? <LoadingState message="Loading assignments…" /> : null}
      {missing ? <EmptyState message="This course is not available." /> : null}
      {course && !loadError && !loading ? (
        <>
          <CreateAssignmentForm
            courseId={course.id}
            onNotice={setNotice}
            onCreated={(assignment) =>
              setAssignments((current) => [...current, assignment].sort(compareCoursesNewestFirst))
            }
          />
          {assignments.length === 0 ? (
            <EmptyState message="This course has no assignments yet." />
          ) : (
            assignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onNotice={setNotice}
                onUpdated={(assignmentId, text) =>
                  setAssignments((current) =>
                    current.map((item) =>
                      item.id === assignmentId
                        ? {
                            ...item,
                            title: text.title,
                            description: text.description,
                            dueDate: text.dueDate,
                          }
                        : item,
                    ),
                  )
                }
              />
            ))
          )}
        </>
      ) : null}
    </section>
  );
}

function CreateAssignmentForm({
  courseId,
  onNotice,
  onCreated,
}: {
  courseId: string;
  onNotice: (notice: Notice) => void;
  onCreated: (assignment: CourseAssignment) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const draft = assignmentDraft(title, description, dueDate);
    if (!draft.ok) {
      onNotice({ saved: false, message: draft.message });
      return;
    }

    setBusy(true);
    const result = await createAssignment(courseId, draft.assignment);
    setBusy(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    setTitle("");
    setDescription("");
    setDueDate("");
    onCreated(result.assignment);
    onNotice({ saved: true, message: "This assignment was saved." });
  }

  return (
    <form
      className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-none"
      onSubmit={handleSubmit}
    >
      <AssignmentFields
        idPrefix="new-assignment"
        title={title}
        description={description}
        dueDate={dueDate}
        disabled={busy}
        onTitle={setTitle}
        onDescription={setDescription}
        onDueDate={setDueDate}
      />
      <Button type="submit" disabled={busy}>
        <Save />
        {busy ? "Saving…" : "Save assignment"}
      </Button>
    </form>
  );
}

function AssignmentCard({
  assignment,
  onNotice,
  onUpdated,
}: {
  assignment: CourseAssignment;
  onNotice: (notice: Notice) => void;
  onUpdated: (assignmentId: string, text: AssignmentText) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(assignment.title ?? "");
  const [description, setDescription] = useState(assignment.description ?? "");
  const [dueDate, setDueDate] = useState(toDateTimeLocal(assignment.dueDate));
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const draft = assignmentDraft(title, description, dueDate);
    if (!draft.ok) {
      onNotice({ saved: false, message: draft.message });
      return;
    }

    setBusy(true);
    const result = await updateAssignment(assignment.id, draft.assignment);
    setBusy(false);
    if (!result.ok) {
      onNotice({ saved: false, message: result.message });
      return;
    }

    setTitle(draft.assignment.title);
    setDescription(draft.assignment.description);
    setDueDate(toDateTimeLocal(draft.assignment.dueDate));
    onUpdated(assignment.id, draft.assignment);
    onNotice({ saved: true, message: "This assignment was updated." });
  }

  function closeEdit() {
    setTitle(assignment.title ?? "");
    setDescription(assignment.description ?? "");
    setDueDate(toDateTimeLocal(assignment.dueDate));
    setEditing(false);
  }

  return (
    <article className="space-y-3 rounded-sm border border-border bg-card p-4 shadow-none">
      <h2 className="text-base font-medium text-foreground">{assignment.title ?? ""}</h2>
      <p className="whitespace-pre-wrap text-sm text-foreground">{assignment.description ?? ""}</p>
      {editing ? (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <AssignmentFields
            idPrefix={`assignment-${assignment.id}`}
            title={title}
            description={description}
            dueDate={dueDate}
            disabled={busy}
            onTitle={setTitle}
            onDescription={setDescription}
            onDueDate={setDueDate}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              <Save />
              {busy ? "Saving…" : "Save assignment"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={closeEdit}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="space-y-3 text-sm">
            <AssignmentFact label="Due date" value={formatDueAt(assignment.dueDate)} />
            <AssignmentFact label="Created" value={formatCreatedAt(assignment.createdAt)} />
          </dl>
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </>
      )}
    </article>
  );
}

function AssignmentFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-foreground">{value}</dd>
    </div>
  );
}

function AssignmentFields({
  idPrefix,
  title,
  description,
  dueDate,
  disabled,
  onTitle,
  onDescription,
  onDueDate,
}: {
  idPrefix: string;
  title: string;
  description: string;
  dueDate: string;
  disabled: boolean;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onDueDate: (value: string) => void;
}) {
  return (
    <>
      <Field
        id={`${idPrefix}-title`}
        label="Title"
        required
        hint="This will be the name of the assignment."
      >
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          disabled={disabled}
        />
      </Field>
      <Field
        id={`${idPrefix}-description`}
        label="Description"
        required
        hint="What the learner needs to do."
      >
        <Textarea
          id={`${idPrefix}-description`}
          value={description}
          className="min-h-28"
          onChange={(event) => onDescription(event.target.value)}
          disabled={disabled}
        />
      </Field>
      <Field id={`${idPrefix}-due`} label="Due date" hint="Optional.">
        <Input
          id={`${idPrefix}-due`}
          type="datetime-local"
          value={dueDate}
          onChange={(event) => onDueDate(event.target.value)}
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

