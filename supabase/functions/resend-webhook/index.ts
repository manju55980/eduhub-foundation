import { createClient } from "jsr:@supabase/supabase-js@2";

import { bindDeliveryStore, handleResendWebhook } from "../_shared/student-integrations.ts";
import type { EventWriteClient } from "../_shared/student-integrations.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get(name: string): string | undefined };
};

Deno.serve((request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const store =
    supabaseUrl && serviceKey
      ? bindDeliveryStore(
          createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          }) as EventWriteClient,
        )
      : null;

  return handleResendWebhook(request, {
    webhookSecret: Deno.env.get("RESEND_WEBHOOK_SECRET"),
    store,
  });
});
