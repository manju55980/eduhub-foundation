import { compareLessons } from "@/features/instructor/lesson-draft";
import { supabase } from "@/integrations/supabase/client";

import type { PendingLesson } from "./approve-courses-api";
import type { AdminCourse } from "./manage-courses";

export async function listAdminCourses() {
  const coursesResult = await supabase
    .from("courses")
    .select("id, title, description, level, status, instructor_id, created_at")
    .order("created_at", { ascending: false });
  if (coursesResult.error) return { ok: false as const, message: coursesResult.error.message };

  const courses = coursesResult.data ?? [];
  if (courses.length === 0) return { ok: true as const, courses: [] satisfies AdminCourse[] };

  const instructorIds = [...new Set(courses.map((course) => course.instructor_id))];
  const profilesResult = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", instructorIds);
  if (profilesResult.error) return { ok: false as const, message: profilesResult.error.message };

  const lessonsResult = await supabase
    .from("lessons")
    .select("id, course_id, title, content, video_url, order_index, created_at")
    .in(
      "course_id",
      courses.map((course) => course.id),
    )
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (lessonsResult.error) return { ok: false as const, message: lessonsResult.error.message };

  const names = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const lessonsByCourse = new Map<string, PendingLesson[]>();
  for (const row of lessonsResult.data ?? []) {
    const current = lessonsByCourse.get(row.course_id) ?? [];
    current.push(toLesson(row));
    lessonsByCourse.set(row.course_id, current);
  }

  return {
    ok: true as const,
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      level: course.level,
      status: course.status,
      instructorName: names.get(course.instructor_id) ?? null,
      createdAt: course.created_at,
      lessons: (lessonsByCourse.get(course.id) ?? []).sort(compareLessons),
    })),
  };
}

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
