import { supabase } from "@/integrations/supabase/client";

import { compareLessons } from "@/features/instructor/lesson-draft";

export type LearningLesson = {
  id: string;
  title: string | null;
  content: string | null;
  videoUrl: string | null;
  orderIndex: number | null;
  createdAt: string;
};

export type LearningCourse = {
  id: string;
  title: string | null;
};

function toLesson(row: {
  id: string;
  title: string | null;
  content: string | null;
  video_url: string | null;
  order_index: number | null;
  created_at: string;
}): LearningLesson {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    videoUrl: row.video_url,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

export async function loadCourseLearning(courseId: string, studentId: string) {
  const courseResult = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .maybeSingle();
  if (courseResult.error) return { ok: false as const, message: courseResult.error.message };
  if (!courseResult.data) return { ok: true as const, course: null };

  const course: LearningCourse = { id: courseResult.data.id, title: courseResult.data.title };
  const enrollmentResult = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (enrollmentResult.error)
    return { ok: false as const, message: enrollmentResult.error.message };
  if (!enrollmentResult.data) return { ok: true as const, course, enrolled: false as const };

  const lessonsResult = await supabase
    .from("lessons")
    .select("id, title, content, video_url, order_index, created_at")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (lessonsResult.error) return { ok: false as const, message: lessonsResult.error.message };

  return {
    ok: true as const,
    course,
    enrolled: true as const,
    lessons: (lessonsResult.data ?? []).map(toLesson).sort(compareLessons),
  };
}
