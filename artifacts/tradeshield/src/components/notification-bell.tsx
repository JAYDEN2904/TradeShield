import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import {
  useListNotifications,
  useGetUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
  getGetUnreadNotificationCountQueryKey,
  type Notification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotificationSocket } from "@/hooks/use-notification-socket";
import { useState } from "react";

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

export function NotificationBell() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  useNotificationSocket(true);

  const { data: unread } = useGetUnreadNotificationCount({
    query: { queryKey: getGetUnreadNotificationCountQueryKey() },
  });
  const { data: notifications = [], isLoading } = useListNotifications({
    query: {
      queryKey: getListNotificationsQueryKey(),
      enabled: open,
    },
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

  const unreadCount = unread?.count ?? 0;
  const preview = notifications.slice(0, 8);

  const openNotification = (n: Notification) => {
    if (!n.readAt) {
      markReadMut.mutate({ id: n.id });
    }
    setOpen(false);
    setLocation(notificationHref(n));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          data-testid="btn-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : preview.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            <ul className="divide-y">
              {preview.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      !n.readAt && "bg-primary/5",
                    )}
                    onClick={() => openNotification(n)}
                  >
                    <div className="flex items-start gap-2">
                      {!n.readAt && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className={cn("min-w-0 flex-1", n.readAt && "pl-3.5")}>
                        <p className="text-sm font-medium leading-snug">
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          {formatCreatedAt(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link href="/notifications">
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => setOpen(false)}
              data-testid="link-view-all-notifications"
            >
              View all
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
