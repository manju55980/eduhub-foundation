import { createClient } from "jsr:@supabase/supabase-js@2";

import { bindCampaignDb, handleAdminCampaign } from "../_shared/campaigns.ts";
import type { CampaignRpc } from "../_shared/campaigns.ts";
import { integrationSecretsFromEnv } from "../_shared/student-integrations.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get(name: string): string | undefined };
};

Deno.serve((request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = request.headers.get("Authorization");

  return handleAdminCampaign(request, {
    supabaseUrl,
    publishableKey,
    authorization,
    secrets: integrationSecretsFromEnv((name) => Deno.env.get(name)),
    fetchImpl: fetch,
    db: bindCampaignDb(
      createClient(supabaseUrl ?? "", publishableKey ?? "", {
        global: { headers: authorization ? { Authorization: authorization } : {} },
        auth: { persistSession: false, autoRefreshToken: false },
      }) as CampaignRpc,
    ),
  });
});
