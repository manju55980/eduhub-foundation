import { createClient } from "jsr:@supabase/supabase-js@2";

import { handleCourseReview } from "../_shared/handle-course-review.ts";
import { bindReviewReader, type ReviewDb } from "../_shared/review-reader.ts";

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

  return handleCourseReview(request, {
    supabaseUrl,
    publishableKey,
    geminiKey,
    authorization,
    fetchImpl: fetch,
    reader: bindReviewReader(
      createClient(supabaseUrl ?? "", publishableKey ?? "", {
        global: { headers: authorization ? { Authorization: authorization } : {} },
        auth: { persistSession: false, autoRefreshToken: false },
      }) as ReviewDb,
      token,
    ),
  });
});
