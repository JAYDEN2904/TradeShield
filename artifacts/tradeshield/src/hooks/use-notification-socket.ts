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

/** Production API host — Vercel rewrites cannot proxy WebSocket upgrades. */
const PROD_API_WS_BASE = "wss://tradeshield-i76i.onrender.com";

function notificationsWsBase(): string {
  const fromEnv = import.meta.env.VITE_API_WS_URL as string | undefined;
  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }
  return PROD_API_WS_BASE;
}

function usesSameOriginWs(base: string): boolean {
  try {
    const host = new URL(base.replace(/^ws/i, "http")).host;
    return host === window.location.host;
  } catch {
    return false;
  }
}

async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/notifications/ws-token", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Keeps the notification list + unread badge live via WebSocket.
 * Reconnects with exponential backoff while the user is logged in.
 * Falls back to periodic refetch if the socket cannot stay up.
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
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const invalidate = () => {
      const qc = queryClientRef.current;
      void qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      void qc.invalidateQueries({
        queryKey: getGetUnreadNotificationCountQueryKey(),
      });
    };

    // REST polling backup (covers Vercel/WS gaps and hibernation reconnects)
    pollTimer = setInterval(invalidate, 20_000);

    const connect = async () => {
      if (disposed) return;

      const base = notificationsWsBase();
      let url = `${base}/api/ws/notifications`;

      if (!usesSameOriginWs(base)) {
        const token = await fetchWsToken();
        if (!token) {
          retryTimer = setTimeout(() => {
            retryMs = Math.min(retryMs * 2, 30_000);
            void connect();
          }, retryMs);
          return;
        }
        url += `?token=${encodeURIComponent(token)}`;
      }

      socket = new WebSocket(url);

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
          void connect();
        }, retryMs);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    void connect();

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
      if (pollTimer) clearInterval(pollTimer);
      socket?.close();
    };
  }, [enabled]);
}
