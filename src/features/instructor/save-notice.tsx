import { Check, X } from "lucide-react";

import { ErrorState } from "@/components/app-shell/page-state";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/roles";

const tones: Record<AppRole, string> = {
  student: "bg-student-soft",
  instructor: "bg-instructor-soft",
  admin: "bg-admin-soft",
};

export function SaveNotice({
  saved,
  message,
  onDismiss,
  tone = "instructor",
}: {
  saved: boolean;
  message: string;
  onDismiss: () => void;
  tone?: AppRole;
}) {
  if (saved && message) {
    return (
      <div
        role="status"
        className={cn(
          "flex min-w-0 items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground",
          tones[tone],
        )}
      >
        <Check className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1 leading-relaxed [overflow-wrap:anywhere]">{message}</p>
        <button
          type="button"
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (!message) return null;

  return <ErrorState message={message} />;
}
