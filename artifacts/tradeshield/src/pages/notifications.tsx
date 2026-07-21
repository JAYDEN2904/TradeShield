import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
  getGetUnreadNotificationCountQueryKey,
  type Notification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function notificationHref(n: Notification): string {
  if (n.link) return n.link;
  if (n.orderId) return `/orders/${n.orderId}`;
  return "/notifications";
}

function formatCreatedAt(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey() },
  });

  const markReadMut = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: getListNotificationsQueryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: getGetUnreadNotificationCountQueryKey(),
        });
      },
    },
  });

  const markAllMut = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: getListNotificationsQueryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: getGetUnreadNotificationCountQueryKey(),
        });
      },
    },
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const openNotification = (n: Notification) => {
    if (!n.readAt) {
      markReadMut.mutate({ id: n.id });
    }
    setLocation(notificationHref(n));
  };

  return (
    <div className="ts-container-wide py-8">
      <PageHeader
        title="Notifications"
        description="Updates from the last 30 days. Tap an item to open the related order."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-medium">No notifications yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                When orders move forward — accepted, paid, shipped, and more —
                you&apos;ll see them here and get an SMS with a direct link.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={cn(
                    "w-full rounded-lg border px-4 py-4 text-left transition-colors hover:bg-muted/50",
                    !n.readAt
                      ? "border-primary/20 bg-primary/5"
                      : "border-border/80 bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.readAt && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <p className="font-medium leading-snug">{n.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {n.body}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatCreatedAt(n.createdAt)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
