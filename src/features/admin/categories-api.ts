import { supabase } from "@/integrations/supabase/client";

import {
  categoryInsert,
  categoryName,
  type CourseCategory,
} from "@/features/categories/category-name";

export async function createCategory(value: string) {
  const draft = categoryName(value);
  if (!draft.ok) return draft;

  const { data, error } = await supabase
    .from("categories")
    .insert(categoryInsert(draft.name))
    .select("id, name, created_at")
    .single();

  if (error) return { ok: false as const, message: error.message };

  const category: CourseCategory = {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
  };
  return { ok: true as const, category };
}

export async function renameCategory(categoryId: string, value: string) {
  const draft = categoryName(value);
  if (!draft.ok) return draft;

  const { error } = await supabase
    .from("categories")
    .update(categoryInsert(draft.name))
    .eq("id", categoryId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, name: draft.name };
}

export async function deleteCategory(categoryId: string) {
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
