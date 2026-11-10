import { createFileRoute } from "@tanstack/react-router";

import { CampaignScreen } from "@/features/admin/campaign-screen";

export const Route = createFileRoute("/admin/campaigns")({
  component: CampaignScreen,
});
