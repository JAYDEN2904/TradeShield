import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListNotificationsQueryKey,
  getGetUnreadNotificationCountQueryKey,
  type Notification,
} from "@workspace/api-client-react";

type WsMessage =
  | { type: "connected" }
  | { type: "notification"; notification: Notification };

function notificationsWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/notifications`;
}

/**
 * Keeps the notification list + unread badge live via WebSocket.
 * Reconnects with exponential backoff while the user is logged in.
 */
export function useNotificationSocket(enabled: boolean): void {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    if (!enabled) return;

    let socket: WebSocket | null = null;
    let disposed = false;
    let retryMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidate = () => {
      const qc = queryClientRef.current;
      void qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      void qc.invalidateQueries({
        queryKey: getGetUnreadNotificationCountQueryKey(),
      });
    };

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(notificationsWsUrl());

      socket.onopen = () => {
        retryMs = 1000;
      };

      socket.onmessage = (event) => {
        let data: WsMessage;
        try {
          data = JSON.parse(String(event.data)) as WsMessage;
        } catch {
          return;
        }

        if (data.type === "notification") {
          const incoming = data.notification;
          const qc = queryClientRef.current;
          qc.setQueryData<Notification[]>(
            getListNotificationsQueryKey(),
            (prev) => {
              const existing = prev ?? [];
              if (existing.some((n) => n.id === incoming.id)) {
                return existing;
              }
              return [incoming, ...existing];
            },
          );
          qc.setQueryData<{ count: number }>(
            getGetUnreadNotificationCountQueryKey(),
            (prev) => ({ count: (prev?.count ?? 0) + 1 }),
          );
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        retryTimer = setTimeout(() => {
          retryMs = Math.min(retryMs * 2, 30_000);
          connect();
        }, retryMs);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    // Refetch when tab becomes visible again (covers missed WS messages)
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [enabled]);
}
