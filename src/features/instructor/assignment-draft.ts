export type AssignmentText = {
  title: string;
  description: string;
  dueDate: string | null;
};

export function assignmentDraft(
  title: string,
  description: string,
  dueDate: string,
): { ok: true; assignment: AssignmentText } | { ok: false; message: string } {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const trimmedDue = dueDate.trim();
  const messages: string[] = [];

  if (!trimmedTitle) messages.push("Enter an assignment title.");
  if (!trimmedDescription) messages.push("Enter an assignment description.");

  let due: string | null = null;
  if (trimmedDue) {
    const parsed = new Date(trimmedDue);
    if (Number.isNaN(parsed.getTime())) messages.push("Enter a valid due date.");
    else due = parsed.toISOString();
  }

  if (messages.length > 0) return { ok: false, message: messages.join(" ") };

  return {
    ok: true,
    assignment: {
      title: trimmedTitle,
      description: trimmedDescription,
      dueDate: due,
    },
  };
}

export function assignmentInsert(courseId: string, assignment: AssignmentText) {
  return {
    course_id: courseId,
    title: assignment.title,
    description: assignment.description,
    due_date: assignment.dueDate,
  };
}

export function assignmentFieldUpdate(assignment: AssignmentText) {
  return {
    title: assignment.title,
    description: assignment.description,
    due_date: assignment.dueDate,
  };
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
