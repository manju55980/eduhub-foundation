import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { LoadingState } from "@/components/app-shell/page-state";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SaveNotice } from "@/features/instructor/save-notice";
import type { AppRole } from "@/lib/roles";

import { NotificationList } from "./notification-list";
import { listNotifications, markNotificationRead, type AppNotification } from "./notifications-api";

export function NotificationBell({ userId, role }: { userId: string; role: AppRole }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState("");

  useEffect(() => {
    let active = true;
    listNotifications(userId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotifications(result.notifications);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function markRead(notificationId: string) {
    setPendingId(notificationId);
    const result = await markNotificationRead(notificationId, userId);
    setPendingId("");
    if (!result.ok) {
      setNotice("");
      setError(result.message);
      return;
    }
    setError("");
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt: new Date().toISOString() }
          : notification,
      ),
    );
    setNotice("Notification marked read.");
  }

  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative shrink-0 rounded-sm shadow-none"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-medium text-destructive-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-sm p-3 shadow-none"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          {notice ? (
            <SaveNotice saved message={notice} tone={role} onDismiss={() => setNotice("")} />
          ) : null}
          {loading ? <LoadingState message="Loading notifications…" /> : null}
          {!loading ? (
            <div className="max-h-80 overflow-y-auto">
              <NotificationList
                notifications={notifications}
                error={error}
                pendingId={pendingId}
                onMarkRead={(notificationId) => void markRead(notificationId)}
              />
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
