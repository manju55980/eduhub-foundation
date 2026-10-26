import { createClient } from "jsr:@supabase/supabase-js@2";

import { bindAgentReader } from "../_shared/agent-reader.ts";
import { handleAgent } from "../_shared/handle-agent.ts";

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
  const ollamaHost = Deno.env.get("OLLAMA_HOST");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  return handleAgent(request, {
    supabaseUrl,
    publishableKey,
    geminiKey,
    ollamaHost,
    authorization,
    fetchImpl: fetch,
    reader: bindAgentReader(
      createClient(supabaseUrl ?? "", publishableKey ?? "", {
        global: { headers: authorization ? { Authorization: authorization } : {} },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      token,
    ),
  });
});
