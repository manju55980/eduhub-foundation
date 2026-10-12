import { compareCoursesNewestFirst } from "@/features/instructor/course-update";
import { supabase } from "@/integrations/supabase/client";

export async function listUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false });

  if (error) return { ok: false as const, message: error.message };

  const users = (data ?? [])
    .map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      createdAt: profile.created_at,
    }))
    .sort(compareCoursesNewestFirst);

  return { ok: true as const, users };
}

export async function promoteStudent(userId: string) {
  const { error } = await supabase.rpc("promote_student_to_instructor", {
    target_id: userId,
  });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
