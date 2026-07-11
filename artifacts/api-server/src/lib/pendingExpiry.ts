/**
 * Expires orders stuck in pending_supplier_confirmation after 24 hours.
 */
import { eq, and, lte } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { applyTransition, InvalidOrderTransitionError } from "./orderStateMachine";
import { fireAndForget, notifyOrderExpired } from "./orderNotifications";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 1000;

async function expirePendingOrders(): Promise<void> {
  const now = new Date();
  const staleOrders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "pending_supplier_confirmation"),
        lte(ordersTable.expiresAt, now),
      ),
    );

  for (const order of staleOrders) {
    try {
      const nextStatus = applyTransition(order.status, "expired", "system");
      const [updated] = await db
        .update(ordersTable)
        .set({ status: nextStatus })
        .where(eq(ordersTable.id, order.id))
        .returning();

      if (updated) {
        fireAndForget(notifyOrderExpired(updated), "order_expired");
      }

      logger.info({ orderId: order.id }, "Pending order auto-expired after 24h");
    } catch (err) {
      if (err instanceof InvalidOrderTransitionError) {
        logger.warn(
          { orderId: order.id, err: err.message },
          "Pending expiry: invalid transition, skipping",
        );
        continue;
      }
      logger.error({ orderId: order.id, err }, "Pending expiry job failed for order");
    }
  }
}

let timer: NodeJS.Timeout | undefined;

export function startPendingExpiryJob(): void {
  if (timer) return;
  timer = setInterval(() => {
    expirePendingOrders().catch((err) => {
      logger.error({ err }, "Pending expiry job tick failed");
    });
  }, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Pending expiry job started");
}

export function stopPendingExpiryJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}
