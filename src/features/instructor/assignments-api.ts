import { supabase } from "@/integrations/supabase/client";

import { compareCoursesNewestFirst } from "./course-update";

import { assignmentFieldUpdate, assignmentInsert, type AssignmentText } from "./assignment-draft";

export type CourseAssignment = {
  id: string;
  title: string | null;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
};

function toAssignment(row: {
  id: string;
  title: string | null;
  description: string | null;
  due_date: string | null;
  created_at: string;
}): CourseAssignment {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    createdAt: row.created_at,
  };
}

export async function listCourseAssignments(courseId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("id, title, description, due_date, created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false as const, message: error.message };
  return {
    ok: true as const,
    assignments: (data ?? []).map(toAssignment).sort(compareCoursesNewestFirst),
  };
}

export async function createAssignment(courseId: string, assignment: AssignmentText) {
  const { data, error } = await supabase
    .from("assignments")
    .insert(assignmentInsert(courseId, assignment))
    .select("id, title, description, due_date, created_at")
    .single();

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, assignment: toAssignment(data) };
}

export async function updateAssignment(assignmentId: string, assignment: AssignmentText) {
  const { error } = await supabase
    .from("assignments")
    .update(assignmentFieldUpdate(assignment))
    .eq("id", assignmentId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
