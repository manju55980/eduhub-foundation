import { supabase } from "@/integrations/supabase/client";

import { draftCourseInsert, type CourseLevel } from "./course-draft";

export async function createDraftCourse(input: {
  instructorId: string;
  title: string;
  description: string;
  level: CourseLevel;
  categoryId: string | null;
}) {
  const { error } = await supabase.from("courses").insert(draftCourseInsert(input));

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
