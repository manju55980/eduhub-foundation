import { createClient } from "jsr:@supabase/supabase-js@2";

import { handleStudy } from "../_shared/handle-study.ts";
import { bindStudyReader } from "../_shared/study-reader.ts";

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

  return handleStudy(request, {
    supabaseUrl,
    publishableKey,
    geminiKey,
    authorization,
    fetchImpl: fetch,
    reader: bindStudyReader(
      createClient(supabaseUrl ?? "", publishableKey ?? "", {
        global: { headers: authorization ? { Authorization: authorization } : {} },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "",
    ),
  });
});
