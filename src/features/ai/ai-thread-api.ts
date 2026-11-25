import { supabase } from "@/integrations/supabase/client";

import { newThreadTitle, type AiSurface } from "../../../supabase/functions/_shared/ai-thread.ts";

export type AiThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type AiThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  payload: Record<string, unknown>;
};

const signedOut = "You need to be signed in.";

function summary(row: { id: string; title: string; updated_at: string }): AiThreadSummary {
  return { id: row.id, title: row.title, updatedAt: row.updated_at };
}

export async function listAiThreads(surface: AiSurface, courseId: string | null) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) return { ok: false as const, message: signedOut };

  const query = supabase
    .from("ai_threads")
    .select("id, title, updated_at")
    .eq("surface", surface)
    .order("updated_at", { ascending: false });
  const scoped = courseId ? query.eq("course_id", courseId) : query.is("course_id", null);
  const { data, error } = await scoped;
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, threads: (data ?? []).map(summary) };
}

export async function createAiThread(surface: AiSurface, courseId: string | null) {
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) return { ok: false as const, message: signedOut };

  const { data, error } = await supabase
    .from("ai_threads")
    .insert({
      user_id: userId,
      surface,
      title: newThreadTitle,
      course_id: courseId,
    })
    .select("id, title, updated_at")
    .single();
  if (error || !data) return { ok: false as const, message: error?.message ?? signedOut };
  return { ok: true as const, thread: summary(data) };
}

export async function loadAiMessages(threadId: string) {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, payload, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false as const, message: error.message };

  const messages: AiThreadMessage[] = [];
  for (const row of data ?? []) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
    messages.push({ id: row.id, role: row.role, content: row.content, payload });
  }
  return { ok: true as const, messages };
}

export async function clearAiMessages(threadId: string) {
  const { error } = await supabase.from("ai_messages").delete().eq("thread_id", threadId);
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
