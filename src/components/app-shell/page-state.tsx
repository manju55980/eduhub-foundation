import type { ReactNode } from "react";
import { CircleAlert, Inbox, LoaderCircle } from "lucide-react";

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 shrink-0 animate-spin" />
      <p className="min-w-0 leading-relaxed [overflow-wrap:anywhere]">{message}</p>
    </div>
  );
}

export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="flex min-w-0 items-start gap-2">
        <Inbox className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {message}
          </p>
          {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex min-w-0 items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 leading-relaxed [overflow-wrap:anywhere]">{message}</p>
    </div>
  );
}
