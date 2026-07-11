import { eq, and } from "drizzle-orm";
import { db, ordersTable, transactionsTable } from "@workspace/db";
import {
  applyTransition,
  InvalidOrderTransitionError,
} from "./orderStateMachine";
import { logger } from "./logger";
import {
  fireAndForget,
  notifyPaymentInEscrow,
  notifyPayoutCompleted,
  notifyPayoutFailed,
} from "./orderNotifications";

export type WebhookOutcome = "succeeded" | "failed";

export type PaymentWebhookResult = {
  applied: boolean;
  orderId: number;
  moolreReference: string;
};

/**
 * Applies a Collections webhook (or polling reconciliation) outcome.
 * Idempotent per moolreReference — duplicate deliveries are no-ops.
 */
export async function applyCollectionWebhook(input: {
  orderId: number;
  moolreReference: string;
  status: WebhookOutcome;
}): Promise<PaymentWebhookResult> {
  const { orderId, moolreReference, status } = input;

  const [existingTxn] = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.orderId, orderId),
        eq(transactionsTable.type, "collection"),
        eq(transactionsTable.moolreReference, moolreReference),
      ),
    );

  if (existingTxn && existingTxn.status !== "pending") {
    logger.info({ orderId, moolreReference }, "Duplicate collection webhook ignored");
    return { applied: false, orderId, moolreReference };
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    logger.warn({ orderId, moolreReference }, "Collection webhook for unknown order");
    return { applied: false, orderId, moolreReference };
  }

  const targetStatus = status === "succeeded" ? "in_escrow" : "awaiting_payment";

  try {
    const nextStatus = applyTransition(order.status, targetStatus, "system");
    await db
      .update(ordersTable)
      .set({ status: nextStatus })
      .where(eq(ordersTable.id, orderId));
  } catch (err) {
    if (!(err instanceof InvalidOrderTransitionError)) {
      throw err;
    }
    logger.warn(
      { orderId, err: err.message },
      "Collection webhook: invalid transition ignored",
    );
  }

  if (existingTxn) {
    await db
      .update(transactionsTable)
      .set({ status })
      .where(eq(transactionsTable.id, existingTxn.id));
  } else {
    await db.insert(transactionsTable).values({
      orderId,
      type: "collection",
      moolreReference,
      status,
      amount: order.totalAmount,
    });
  }

  if (status === "succeeded") {
    const [updatedOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (updatedOrder?.status === "in_escrow") {
      fireAndForget(notifyPaymentInEscrow(updatedOrder), "payment_escrow");
    }
  }

  return { applied: true, orderId, moolreReference };
}

/**
 * Applies a Disbursement webhook (or polling reconciliation) outcome.
 * Idempotent per moolreReference — duplicate deliveries are no-ops.
 */
export async function applyDisbursementWebhook(input: {
  orderId: number;
  moolreReference: string;
  status: WebhookOutcome;
}): Promise<PaymentWebhookResult> {
  const { orderId, moolreReference, status } = input;

  const [existingTxn] = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.orderId, orderId),
        eq(transactionsTable.type, "disbursement"),
        eq(transactionsTable.moolreReference, moolreReference),
      ),
    );

  if (existingTxn && existingTxn.status !== "pending") {
    logger.info({ orderId, moolreReference }, "Duplicate disbursement webhook ignored");
    return { applied: false, orderId, moolreReference };
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    logger.warn({ orderId, moolreReference }, "Disbursement webhook for unknown order");
    return { applied: false, orderId, moolreReference };
  }

  const targetStatus = status === "succeeded" ? "completed" : "payout_failed";
  const payoutAmount =
    existingTxn?.amount ??
    (Number(order.totalAmount) - Number(order.platformFee)).toFixed(2);

  try {
    const nextStatus = applyTransition(order.status, targetStatus, "system");
    await db
      .update(ordersTable)
      .set({ status: nextStatus })
      .where(eq(ordersTable.id, orderId));
  } catch (err) {
    if (!(err instanceof InvalidOrderTransitionError)) {
      throw err;
    }
    logger.warn(
      { orderId, err: err.message },
      "Disbursement webhook: invalid transition ignored",
    );
  }

  if (existingTxn) {
    await db
      .update(transactionsTable)
      .set({ status })
      .where(eq(transactionsTable.id, existingTxn.id));
  } else {
    await db.insert(transactionsTable).values({
      orderId,
      type: "disbursement",
      moolreReference,
      status,
      amount: payoutAmount,
    });
  }

  if (status === "succeeded") {
    const [updatedOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (updatedOrder?.status === "completed") {
      fireAndForget(notifyPayoutCompleted(updatedOrder), "payout_completed");
    }
  } else if (status === "failed") {
    const [updatedOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (updatedOrder?.status === "payout_failed") {
      fireAndForget(notifyPayoutFailed(updatedOrder), "payout_failed");
    }
  }

  return { applied: true, orderId, moolreReference };
}
