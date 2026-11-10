import { createClient } from "jsr:@supabase/supabase-js@2";

import { bindDeliveryStore, handleResendWebhook } from "../_shared/student-integrations.ts";
import type { CampaignDelivery, EventWriteClient } from "../_shared/student-integrations.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get(name: string): string | undefined };
};

Deno.serve((request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const client =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  const store = client ? bindDeliveryStore(client as EventWriteClient) : null;
  const campaigns: CampaignDelivery | null = client
    ? {
        async apply(input) {
          const result = await client.rpc("apply_campaign_delivery", {
            provider_email_id: input.providerEmailId,
            next_status: input.nextStatus,
            suppress_reason: input.suppressReason,
            suppress_email: input.suppressEmail,
          });
          if (result.error) return { ok: false };
          return { ok: true };
        },
      }
    : null;

  return handleResendWebhook(request, {
    webhookSecret: Deno.env.get("RESEND_WEBHOOK_SECRET"),
    store,
    campaigns,
  });
});
