import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export async function handleAssignmentReminderRequest(
  request: Request,
  run: (now: Date) => Promise<{ inserted: number }> = runLiveReminders,
) {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const result = await run(new Date());
    return Response.json({ ok: true, inserted: result.inserted });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "The reminder job failed.");
    return Response.json({ ok: false, message: "The reminder job failed." }, { status: 500 });
  }
}

async function runLiveReminders(now: Date) {
  const { runAssignmentReminderJob } = await import("./assignment-reminders.server");
  return runAssignmentReminderJob(now);
}
