import { Router, type IRouter } from "express";
import {
  ListNotificationsResponse,
  GetUnreadNotificationCountResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import {
  listNotificationsForUser,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/notifications";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const rows = await listNotificationsForUser(req.currentUser!.id);
  res.json(
    ListNotificationsResponse.parse(
      rows.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        orderId: n.orderId,
        link: n.link,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    ),
  );
});

router.get(
  "/notifications/unread-count",
  requireAuth,
  async (req, res): Promise<void> => {
    const count = await countUnreadNotifications(req.currentUser!.id);
    res.json(GetUnreadNotificationCountResponse.parse({ count }));
  },
);

router.post(
  "/notifications/read-all",
  requireAuth,
  async (req, res): Promise<void> => {
    const updated = await markAllNotificationsRead(req.currentUser!.id);
    res.json(MarkAllNotificationsReadResponse.parse({ updated }));
  },
);

router.post(
  "/notifications/:id/read",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = MarkNotificationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const row = await markNotificationRead(
      req.currentUser!.id,
      params.data.id,
    );
    if (!row) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json(
      MarkNotificationReadResponse.parse({
        id: row.id,
        userId: row.userId,
        type: row.type,
        title: row.title,
        body: row.body,
        orderId: row.orderId,
        link: row.link,
        readAt: row.readAt,
        createdAt: row.createdAt,
      }),
    );
  },
);

export default router;
