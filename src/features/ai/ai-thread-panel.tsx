import { Button } from "@/components/ui/button";
import {
  contextWindowSize,
  threadFullMessage,
} from "../../../supabase/functions/_shared/ai-thread.ts";

import type { AiThreadSummary } from "./ai-thread-api";

export function ContextWindowRing({ used }: { used: number }) {
  const safe = Math.max(0, Math.min(used, contextWindowSize));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / contextWindowSize) * circumference;
  return (
    <div
      role="meter"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={contextWindowSize}
      aria-label={`Context window ${safe} of ${contextWindowSize} messages`}
      className="flex items-center gap-2"
    >
      <svg className="text-primary" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span className="text-xs text-muted-foreground">
        {safe} of {contextWindowSize}
      </span>
    </div>
  );
}

export function AiThreadBar({
  threads,
  threadId,
  used,
  onSelect,
  onNew,
  onClear,
}: {
  threads: AiThreadSummary[];
  threadId: string;
  used: number;
  onSelect: (threadId: string) => void;
  onNew: () => void;
  onClear: () => void;
}) {
  const full = used >= contextWindowSize;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContextWindowRing used={used} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onNew}>
            New chat
          </Button>
          <Button type="button" variant="outline" onClick={onClear} disabled={used === 0}>
            Clear chat
          </Button>
        </div>
      </div>
      {threads.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Chats">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Button
                type="button"
                variant={thread.id === threadId ? "default" : "outline"}
                aria-pressed={thread.id === threadId}
                onClick={() => onSelect(thread.id)}
              >
                {thread.title || "New chat"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {full ? <p className="text-sm text-muted-foreground">{threadFullMessage}</p> : null}
    </div>
  );
}
