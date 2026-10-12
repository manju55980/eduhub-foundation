import { createClient } from "jsr:@supabase/supabase-js@2";

import { handleCourseBuilder, type RoleReader } from "../_shared/handle-course-builder.ts";
import { studyRoleColumns } from "../_shared/study-query.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get(name: string): string | undefined };
};

Deno.serve((request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = request.headers.get("Authorization");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const supabase = createClient(supabaseUrl ?? "", publishableKey ?? "", {
    global: { headers: authorization ? { Authorization: authorization } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const reader: RoleReader = {
    async userId() {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return { ok: false, message: "You need to be signed in." };
      return { ok: true, userId: data.user.id };
    },
    async role(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .select(studyRoleColumns)
        .eq("id", userId)
        .maybeSingle();
      if (error) return { ok: false, message: error.message };
      const role = data && typeof data.role === "string" ? data.role : null;
      return { ok: true, role };
    },
  };

  return handleCourseBuilder(request, {
    supabaseUrl,
    publishableKey,
    geminiKey,
    authorization,
    fetchImpl: fetch,
    reader,
  });
});
