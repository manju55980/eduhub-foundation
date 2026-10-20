export const reminderWindowMs = 72 * 60 * 60 * 1000;
export const reminderTitle = "Assignment due soon";

export type AssignmentRow = {
  id: string;
  title: string | null;
  dueDate: string | null;
  courseId: string;
  courseTitle: string | null;
};

export type EnrollmentReminderRow = {
  id: string;
  studentId: string;
  courseId: string;
};

export type SubmissionReminderRow = {
  assignmentId: string;
  studentId: string;
};

export type ReminderCandidate = {
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  dueDate: string | null;
  studentId: string;
  enrollmentId: string;
  submitted: boolean;
};

export type ReminderInsert = {
  recipient_id: string;
  kind: "assignment_due";
  course_id: string;
  enrollment_id: string;
  assignment_id: string;
  title: string;
  body: string;
  dedupe_key: string;
};

export function assignmentReminderKey(assignmentId: string, studentId: string, dueDate: string) {
  return `assignment_due:${assignmentId}:${studentId}:${dueDate}`;
}

export function reminderCandidates(input: {
  assignments: AssignmentRow[];
  enrollments: EnrollmentReminderRow[];
  submissions: SubmissionReminderRow[];
}) {
  const submitted = new Set(input.submissions.map((row) => `${row.assignmentId}:${row.studentId}`));
  const enrollmentsByCourse = new Map<string, EnrollmentReminderRow[]>();
  for (const enrollment of input.enrollments) {
    const list = enrollmentsByCourse.get(enrollment.courseId) ?? [];
    list.push(enrollment);
    enrollmentsByCourse.set(enrollment.courseId, list);
  }

  const candidates: ReminderCandidate[] = [];
  for (const assignment of input.assignments) {
    for (const enrollment of enrollmentsByCourse.get(assignment.courseId) ?? []) {
      candidates.push({
        assignmentId: assignment.id,
        assignmentTitle: assignment.title ?? "",
        courseId: assignment.courseId,
        courseTitle: assignment.courseTitle ?? "",
        dueDate: assignment.dueDate,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        submitted: submitted.has(`${assignment.id}:${enrollment.studentId}`),
      });
    }
  }
  return candidates;
}

export function planAssignmentReminders(
  candidates: ReminderCandidate[],
  now: Date,
  existingKeys: ReadonlySet<string>,
) {
  const start = now.getTime();
  const end = start + reminderWindowMs;
  const seen = new Set(existingKeys);
  const planned: ReminderInsert[] = [];

  for (const candidate of candidates) {
    if (!candidate.dueDate || candidate.submitted) continue;
    const due = Date.parse(candidate.dueDate);
    if (!Number.isFinite(due) || due <= start || due > end) continue;
    const dedupeKey = assignmentReminderKey(
      candidate.assignmentId,
      candidate.studentId,
      candidate.dueDate,
    );
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    planned.push({
      recipient_id: candidate.studentId,
      kind: "assignment_due",
      course_id: candidate.courseId,
      enrollment_id: candidate.enrollmentId,
      assignment_id: candidate.assignmentId,
      title: reminderTitle,
      body: `${candidate.assignmentTitle} is due soon in ${candidate.courseTitle}.`,
      dedupe_key: dedupeKey,
    });
  }

  return planned;
}

export type ReminderStore = {
  loadAssignments(windowStart: string, windowEnd: string): Promise<AssignmentRow[]>;
  loadEnrollments(courseIds: string[]): Promise<EnrollmentReminderRow[]>;
  loadSubmissions(assignmentIds: string[]): Promise<SubmissionReminderRow[]>;
  loadExistingKeys(keys: string[]): Promise<string[]>;
  insertReminders(rows: ReminderInsert[]): Promise<void>;
};

export async function runAssignmentReminders(store: ReminderStore, now: Date) {
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + reminderWindowMs).toISOString();
  const assignments = await store.loadAssignments(windowStart, windowEnd);
  if (assignments.length === 0) return { inserted: 0 };

  const courseIds = [...new Set(assignments.map((row) => row.courseId))];
  const assignmentIds = [...new Set(assignments.map((row) => row.id))];
  const [enrollments, submissions] = await Promise.all([
    store.loadEnrollments(courseIds),
    store.loadSubmissions(assignmentIds),
  ]);
  const planned = planAssignmentReminders(
    reminderCandidates({ assignments, enrollments, submissions }),
    now,
    new Set(),
  );
  if (planned.length === 0) return { inserted: 0 };

  const existing = new Set(await store.loadExistingKeys(planned.map((row) => row.dedupe_key)));
  const fresh = planned.filter((row) => !existing.has(row.dedupe_key));
  if (fresh.length === 0) return { inserted: 0 };
  await store.insertReminders(fresh);
  return { inserted: fresh.length };
}
