/**
 * 72-hour delivery auto-confirmation job. Server-side scheduled job reading
 * `orders.auto_release_at` — must never be driven by a client-side timer.
 *
 * Triggers disbursement via initiateOrderPayout — completion arrives only
 * through the disbursement webhook or polling fallback, never synchronously.
 */
import { eq, and, lte } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";
import { initiateOrderPayout } from "./paymentOrchestration";
import { InvalidOrderTransitionError } from "./orderStateMachine";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 1000;

async function releaseDueOrders(): Promise<void> {
  const now = new Date();
  const dueOrders = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "shipped"), lte(ordersTable.autoReleaseAt, now)));

  for (const order of dueOrders) {
    try {
      const [supplier] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, order.supplierId));

      await initiateOrderPayout(
        order,
        supplier?.payoutMomoNumber ?? "",
        "system",
      );

      logger.info({ orderId: order.id }, "Auto-release initiated payout after 72h window");
    } catch (err) {
      if (err instanceof InvalidOrderTransitionError) {
        logger.warn(
          { orderId: order.id, err: err.message },
          "Auto-release: invalid transition, skipping",
        );
        continue;
      }
      logger.error({ orderId: order.id, err }, "Auto-release job failed for order");
    }
  }
}

let timer: NodeJS.Timeout | undefined;

export function startAutoReleaseJob(): void {
  if (timer) return;
  timer = setInterval(() => {
    releaseDueOrders().catch((err) => {
      logger.error({ err }, "Auto-release job tick failed");
    });
  }, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Auto-release job started");
}

export function stopAutoReleaseJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}
