import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/app-shell/page-state";

import type { AppNotification } from "./notifications-api";

export function NotificationList({
  notifications,
  error,
  pendingId,
  onMarkRead,
}: {
  notifications: AppNotification[];
  error: string;
  pendingId: string;
  onMarkRead: (notificationId: string) => void;
}) {
  if (error && notifications.length === 0) return <ErrorState message={error} />;
  if (notifications.length === 0) return <EmptyState message="No notifications." />;

  return (
    <div className="space-y-2">
      {error ? <ErrorState message={error} /> : null}
      <ul>
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className="space-y-2 border-b border-border py-3 text-sm last:border-b-0"
          >
            <div className="flex min-w-0 items-start gap-2">
              {notification.readAt ? null : (
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive"
                  aria-label="Unread"
                />
              )}
              <p className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">
                {notification.title}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
              {notification.body}
            </p>
            <p className="text-muted-foreground">{formatStamp(notification.createdAt)}</p>
            {notification.readAt ? (
              <p className="text-muted-foreground">Read</p>
            ) : (
              <Button
                type="button"
                disabled={pendingId === notification.id}
                onClick={() => onMarkRead(notification.id)}
              >
                {pendingId === notification.id ? "Marking…" : "Mark read"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CertificateIssued({ title, issuedAt }: { title: string; issuedAt: string }) {
  return (
    <p className="text-sm text-foreground [overflow-wrap:anywhere]">
      Certificate issued. {title}. {formatStamp(issuedAt)}
    </p>
  );
}

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
