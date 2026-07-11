/**
 * Sends 48-hour auto-release reminder SMS (24h before funds auto-release).
 */
import { eq, and, lte, gt } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { fireAndForget, notifyAutoReleaseReminder } from "./orderNotifications";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

async function sendDueReminders(): Promise<void> {
  const now = new Date();
  const reminderThreshold = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const dueOrders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "shipped"),
        eq(ordersTable.autoReleaseReminderSent, false),
        lte(ordersTable.autoReleaseAt, reminderThreshold),
        gt(ordersTable.autoReleaseAt, now),
      ),
    );

  for (const order of dueOrders) {
    try {
      await db
        .update(ordersTable)
        .set({ autoReleaseReminderSent: true })
        .where(eq(ordersTable.id, order.id));

      fireAndForget(notifyAutoReleaseReminder(order), "auto_release_reminder");
      logger.info({ orderId: order.id }, "Auto-release reminder SMS queued");
    } catch (err) {
      logger.error({ orderId: order.id, err }, "Auto-release reminder failed");
    }
  }
}

let timer: NodeJS.Timeout | undefined;

export function startAutoReleaseReminderJob(): void {
  if (timer) return;
  timer = setInterval(() => {
    sendDueReminders().catch((err) => {
      logger.error({ err }, "Auto-release reminder job tick failed");
    });
  }, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Auto-release reminder job started");
}

export function stopAutoReleaseReminderJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}
