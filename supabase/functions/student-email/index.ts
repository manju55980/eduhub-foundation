import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  bindStudentDb,
  handleStudentEmail,
  integrationSecretsFromEnv,
} from "../_shared/student-integrations.ts";
import type { EventWriteClient } from "../_shared/student-integrations.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get(name: string): string | undefined };
};

Deno.serve((request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = request.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const db = bindStudentDb(
    createClient(supabaseUrl ?? "", publishableKey ?? "", {
      global: { headers: authorization ? { Authorization: authorization } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    }) as EventWriteClient,
  );

  return handleStudentEmail(request, {
    supabaseUrl,
    publishableKey,
    authorization,
    secrets: integrationSecretsFromEnv((name) => Deno.env.get(name)),
    fetchImpl: fetch,
    reader: {
      ...db,
      userId: () => db.userId(token),
    },
  });
});
