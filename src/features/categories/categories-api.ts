import { compareCoursesNewestFirst } from "@/features/instructor/course-update";
import { supabase } from "@/integrations/supabase/client";

import type { CourseCategory } from "./category-name";

export async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) return { ok: false as const, message: error.message };

  const categories: CourseCategory[] = (data ?? [])
    .map((category) => ({
      id: category.id,
      name: category.name,
      createdAt: category.created_at,
    }))
    .sort(compareCoursesNewestFirst);

  return { ok: true as const, categories };
}
