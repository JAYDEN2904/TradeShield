import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { RequestHandler } from "express";
import type { Notification } from "@workspace/db";
import { verifyNotificationWsToken } from "./notificationWsAuth";
import { logger } from "./logger";

type AuthedRequest = IncomingMessage & {
  session?: { userId?: number };
};

const socketsByUser = new Map<number, Set<WebSocket>>();

function trackSocket(userId: number, socket: WebSocket): void {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  set.add(socket);
  socket.on("close", () => {
    set!.delete(socket);
    if (set!.size === 0) {
      socketsByUser.delete(userId);
    }
  });
}

function tokenFromUpgradeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("token");
  } catch {
    return null;
  }
}

export function pushNotificationToUser(
  userId: number,
  notification: Notification,
): void {
  const set = socketsByUser.get(userId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify({
    type: "notification",
    notification: {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      orderId: notification.orderId,
      link: notification.link,
      readAt:
        notification.readAt instanceof Date
          ? notification.readAt.toISOString()
          : notification.readAt,
      createdAt:
        notification.createdAt instanceof Date
          ? notification.createdAt.toISOString()
          : notification.createdAt,
    },
  });

  for (const socket of set) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

function acceptConnection(
  wss: WebSocketServer,
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  userId: number,
): void {
  wss.handleUpgrade(req, socket, head, (ws) => {
    trackSocket(userId, ws);
    ws.send(JSON.stringify({ type: "connected" }));
    logger.debug({ userId }, "Notification WebSocket connected");
  });
}

/**
 * Attach `/api/ws/notifications` on the HTTP server.
 * Auth: `?token=` (for cross-origin / Vercel frontends) or session cookie (local).
 */
export function attachNotificationWebSocket(
  server: Server,
  sessionMiddleware: RequestHandler,
): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = req.url?.split("?")[0] ?? "";
    if (path !== "/api/ws/notifications") {
      return;
    }

    const token = tokenFromUpgradeUrl(req.url);
    if (token) {
      const userId = verifyNotificationWsToken(token);
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      acceptConnection(wss, req, socket, head, userId);
      return;
    }

    // express-session expects (req, res, next). For upgrades we pass a stub res.
    const res = {
      getHeader: () => undefined,
      setHeader: () => undefined,
      end: () => undefined,
    } as unknown as Parameters<RequestHandler>[1];

    sessionMiddleware(req as Parameters<RequestHandler>[0], res, () => {
      const userId = (req as AuthedRequest).session?.userId;
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      acceptConnection(wss, req, socket, head, userId);
    });
  });
}
