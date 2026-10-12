import { compareCoursesNewestFirst } from "@/features/instructor/course-update";
import { supabase } from "@/integrations/supabase/client";

import { archivedStatusUpdate } from "./archive-course";

export type PublishedCourse = {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  instructorName: string | null;
  createdAt: string;
};

export async function listPublishedCourses() {
  const coursesResult = await supabase
    .from("courses")
    .select("id, title, description, level, instructor_id, created_at")
    .eq("status", "published")
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

  const names = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]),
  );

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
      }))
      .sort(compareCoursesNewestFirst),
  };
}

export async function archiveCourse(courseId: string) {
  const { error } = await supabase
    .from("courses")
    .update(archivedStatusUpdate())
    .eq("id", courseId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
