import { supabase } from "@/integrations/supabase/client";

import {
  compareLessons,
  lessonFieldUpdate,
  lessonInsert,
  nextLessonOrder,
  type LessonText,
} from "./lesson-draft";

export type OwnedCourse = {
  id: string;
  title: string | null;
};

export type CourseLesson = {
  id: string;
  title: string | null;
  content: string | null;
  videoUrl: string | null;
  orderIndex: number | null;
  createdAt: string;
};

function toLesson(row: {
  id: string;
  title: string | null;
  content: string | null;
  video_url: string | null;
  order_index: number | null;
  created_at: string;
}): CourseLesson {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    videoUrl: row.video_url,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

export async function getOwnedCourse(courseId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .maybeSingle();

  if (error) return { ok: false as const, message: error.message };
  if (!data) return { ok: true as const, course: null };
  return { ok: true as const, course: { id: data.id, title: data.title } };
}

export async function listCourseLessons(courseId: string) {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, title, content, video_url, order_index, created_at")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, lessons: (data ?? []).map(toLesson).sort(compareLessons) };
}

export async function createLesson(courseId: string, lesson: LessonText) {
  const existing = await supabase.from("lessons").select("order_index").eq("course_id", courseId);
  if (existing.error) return { ok: false as const, message: existing.error.message };

  const orderIndex = nextLessonOrder((existing.data ?? []).map((row) => row.order_index));
  const { data, error } = await supabase
    .from("lessons")
    .insert(lessonInsert(courseId, lesson, orderIndex))
    .select("id, title, content, video_url, order_index, created_at")
    .single();

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, lesson: toLesson(data) };
}

export async function updateLesson(lessonId: string, lesson: LessonText) {
  const { error } = await supabase
    .from("lessons")
    .update(lessonFieldUpdate(lesson))
    .eq("id", lessonId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
