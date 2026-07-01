/**
 * 72-hour delivery auto-confirmation job. Server-side scheduled job reading
 * `orders.auto_release_at` — must never be driven by a client-side timer.
 * Runs the disbursement flow exactly the same way `confirmReceipt` does,
 * so a buyer's silence is treated as an implicit confirmation once the
 * window elapses.
 */
import { eq, and, lte } from "drizzle-orm";
import { db, ordersTable, usersTable, transactionsTable } from "@workspace/db";
import { applyTransition, InvalidOrderTransitionError } from "./orderStateMachine";
import { paymentProvider } from "./paymentProvider";
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
      applyTransition(order.status, "completed", "system");

      const [supplier] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, order.supplierId));

      const payoutAmount = (
        Number(order.totalAmount) - Number(order.platformFee)
      ).toFixed(2);

      const disburse = await paymentProvider.disburse({
        orderId: order.id,
        amount: payoutAmount,
        payoutMomoNumber: supplier?.payoutMomoNumber ?? "",
      });

      await db.insert(transactionsTable).values({
        orderId: order.id,
        type: "disbursement",
        moolreReference: disburse.reference,
        status: disburse.status,
        amount: payoutAmount,
      });

      const finalStatus = disburse.status === "failed" ? "payout_failed" : "completed";
      await db
        .update(ordersTable)
        .set({ status: finalStatus })
        .where(eq(ordersTable.id, order.id));

      logger.info({ orderId: order.id, finalStatus }, "Auto-released order after 72h window");
    } catch (err) {
      if (err instanceof InvalidOrderTransitionError) {
        logger.warn({ orderId: order.id, err: err.message }, "Auto-release: invalid transition, skipping");
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
