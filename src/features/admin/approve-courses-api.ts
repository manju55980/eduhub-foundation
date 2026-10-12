import { compareCoursesNewestFirst } from "@/features/instructor/course-update";
import { compareLessons } from "@/features/instructor/lesson-draft";
import { supabase } from "@/integrations/supabase/client";

import { publishedStatusUpdate } from "./publish-course";

export type PendingLesson = {
  id: string;
  title: string | null;
  content: string | null;
  videoUrl: string | null;
  orderIndex: number | null;
  createdAt: string;
};

export type PendingCourse = {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  instructorName: string | null;
  createdAt: string;
  lessons: PendingLesson[];
};

function toLesson(row: {
  id: string;
  title: string | null;
  content: string | null;
  video_url: string | null;
  order_index: number | null;
  created_at: string;
}): PendingLesson {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    videoUrl: row.video_url,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

export async function listPendingCourses() {
  const coursesResult = await supabase
    .from("courses")
    .select("id, title, description, level, instructor_id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (coursesResult.error) return { ok: false as const, message: coursesResult.error.message };

  const courses = coursesResult.data ?? [];
  if (courses.length === 0) return { ok: true as const, courses: [] };

  const instructorIds = [...new Set(courses.map((course) => course.instructor_id))];
  const profilesResult = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", instructorIds);
  if (profilesResult.error) return { ok: false as const, message: profilesResult.error.message };

  const courseIds = courses.map((course) => course.id);
  const lessonsResult = await supabase
    .from("lessons")
    .select("id, course_id, title, content, video_url, order_index, created_at")
    .in("course_id", courseIds)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (lessonsResult.error) return { ok: false as const, message: lessonsResult.error.message };

  const names = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const lessonsByCourse = new Map<string, PendingLesson[]>();
  for (const row of lessonsResult.data ?? []) {
    const lesson = toLesson(row);
    const current = lessonsByCourse.get(row.course_id) ?? [];
    current.push(lesson);
    lessonsByCourse.set(row.course_id, current);
  }

  return {
    ok: true as const,
    courses: courses
      .map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        level: course.level,
        instructorName: names.get(course.instructor_id) ?? null,
        createdAt: course.created_at,
        lessons: (lessonsByCourse.get(course.id) ?? []).sort(compareLessons),
      }))
      .sort(compareCoursesNewestFirst),
  };
}

export async function publishCourse(courseId: string) {
  const { error } = await supabase
    .from("courses")
    .update(publishedStatusUpdate())
    .eq("id", courseId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
