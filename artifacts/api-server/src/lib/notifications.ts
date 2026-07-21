import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import {
  db,
  notificationsTable,
  type Notification,
} from "@workspace/db";
import { pushNotificationToUser } from "./notificationWs";
import { logger } from "./logger";

export const NOTIFICATION_RETENTION_DAYS = 30;

export function notificationRetentionCutoff(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NOTIFICATION_RETENTION_DAYS);
  return cutoff;
}

export async function createNotification(input: {
  userId: number;
  type: string;
  title: string;
  body: string;
  orderId?: number | null;
  link?: string | null;
}): Promise<Notification | null> {
  try {
    const [row] = await db
      .insert(notificationsTable)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        orderId: input.orderId ?? null,
        link: input.link ?? null,
      })
      .returning();

    if (row) {
      pushNotificationToUser(row.userId, row);
    }
    return row ?? null;
  } catch (err) {
    logger.error({ err, input }, "Failed to create notification");
    return null;
  }
}

export async function listNotificationsForUser(
  userId: number,
  limit = 50,
): Promise<Notification[]> {
  const cutoff = notificationRetentionCutoff();
  return db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        gte(notificationsTable.createdAt, cutoff),
      ),
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(
  userId: number,
): Promise<number> {
  const cutoff = notificationRetentionCutoff();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
        gte(notificationsTable.createdAt, cutoff),
      ),
    );
  return row?.count ?? 0;
}

export async function markNotificationRead(
  userId: number,
  notificationId: number,
): Promise<Notification | null> {
  const [row] = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, userId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function markAllNotificationsRead(
  userId: number,
): Promise<number> {
  const cutoff = notificationRetentionCutoff();
  const rows = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
        gte(notificationsTable.createdAt, cutoff),
      ),
    )
    .returning({ id: notificationsTable.id });
  return rows.length;
}

/** Delete notifications older than the retention window (best-effort). */
export async function purgeExpiredNotifications(): Promise<void> {
  try {
    const cutoff = notificationRetentionCutoff();
    await db
      .delete(notificationsTable)
      .where(lt(notificationsTable.createdAt, cutoff));
  } catch (err) {
    logger.error({ err }, "Failed to purge expired notifications");
  }
}
