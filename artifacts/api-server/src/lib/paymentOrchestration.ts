import { eq, and, count } from "drizzle-orm";
import {
  db,
  ordersTable,
  transactionsTable,
  type Order,
} from "@workspace/db";
import {
  applyTransition,
  InvalidOrderTransitionError,
  type TransitionActor,
} from "./orderStateMachine";
import {
  buildCollectionReference,
  buildDisbursementReference,
  buildRefundReference,
} from "./paymentReferences";
import { paymentProvider } from "./paymentProvider";
import { logger } from "./logger";

export class PaymentInProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentInProgressError";
  }
}

async function nextCollectionAttempt(orderId: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.orderId, orderId),
        eq(transactionsTable.type, "collection"),
      ),
    );
  return (row?.total ?? 0) + 1;
}

async function nextDisbursementAttempt(orderId: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.orderId, orderId),
        eq(transactionsTable.type, "disbursement"),
      ),
    );
  return (row?.total ?? 0) + 1;
}

async function hasPendingCollection(orderId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.orderId, orderId),
        eq(transactionsTable.type, "collection"),
        eq(transactionsTable.status, "pending"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function hasPendingDisbursement(orderId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.orderId, orderId),
        eq(transactionsTable.type, "disbursement"),
        eq(transactionsTable.status, "pending"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Initiates a Collections charge. Persists reference + payment_processing
 * before calling the provider. Never transitions to in_escrow synchronously.
 */
export async function initiateOrderCollection(
  order: Order,
  payerPhone: string,
  actor: TransitionActor = "buyer",
): Promise<Order> {
  if (order.status === "payment_processing") {
    const pending = await hasPendingCollection(order.id);
    if (pending) {
      throw new PaymentInProgressError(
        "A payment is already in progress for this order",
      );
    }
  }

  const attempt = await nextCollectionAttempt(order.id);
  const reference = buildCollectionReference(order.id, attempt);

  const nextStatus = applyTransition(
    order.status,
    "payment_processing",
    actor,
  );

  await db.transaction(async (tx) => {
    await tx.insert(transactionsTable).values({
      orderId: order.id,
      type: "collection",
      moolreReference: reference,
      status: "pending",
      amount: order.totalAmount,
    });
    await tx
      .update(ordersTable)
      .set({ status: nextStatus })
      .where(eq(ordersTable.id, order.id));
  });

  try {
    const charge = await paymentProvider.charge({
      orderId: order.id,
      amount: order.totalAmount,
      payerPhone,
      reference,
    });

    if (charge.reference !== reference) {
      logger.warn(
        { orderId: order.id, expected: reference, got: charge.reference },
        "Provider returned unexpected collection reference",
      );
    }
  } catch (err) {
    // Timeout or network error — leave payment_processing; polling/webhook resolves.
    logger.error(
      { orderId: order.id, reference, err },
      "Collection API call failed; order left in payment_processing for reconciliation",
    );
  }

  const [updated] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, order.id));
  if (!updated) {
    throw new Error(`Order ${order.id} not found after collection initiation`);
  }
  return updated;
}

/**
 * Initiates a Bulk Disbursement payout. Persists reference + payout_processing
 * before calling the provider. Never transitions to completed synchronously.
 */
export async function initiateOrderPayout(
  order: Order,
  payoutMomoNumber: string,
  actor: TransitionActor,
  options?: { amount?: string },
): Promise<Order> {
  if (order.status === "payout_processing") {
    const pending = await hasPendingDisbursement(order.id);
    if (pending) {
      throw new PaymentInProgressError(
        "A payout is already in progress for this order",
      );
    }
  }

  if (!payoutMomoNumber.trim()) {
    throw new Error("Supplier payout mobile money number is required");
  }

  const payoutAmount = options?.amount ?? (
    Number(order.totalAmount) - Number(order.platformFee)
  ).toFixed(2);

  const attempt = await nextDisbursementAttempt(order.id);
  const reference = buildDisbursementReference(order.id, attempt);

  const nextStatus = applyTransition(
    order.status,
    "payout_processing",
    actor,
  );

  await db.transaction(async (tx) => {
    await tx.insert(transactionsTable).values({
      orderId: order.id,
      type: "disbursement",
      moolreReference: reference,
      status: "pending",
      amount: payoutAmount,
    });
    await tx
      .update(ordersTable)
      .set({ status: nextStatus })
      .where(eq(ordersTable.id, order.id));
  });

  try {
    const disburse = await paymentProvider.disburse({
      orderId: order.id,
      amount: payoutAmount,
      payoutMomoNumber,
      reference,
    });

    if (disburse.reference !== reference) {
      logger.warn(
        { orderId: order.id, expected: reference, got: disburse.reference },
        "Provider returned unexpected disbursement reference",
      );
    }
  } catch (err) {
    logger.error(
      { orderId: order.id, reference, err },
      "Disbursement API call failed; order left in payout_processing for reconciliation",
    );
  }

  const [updated] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, order.id));
  if (!updated) {
    throw new Error(`Order ${order.id} not found after disbursement initiation`);
  }
  return updated;
}

async function nextRefundAttempt(orderId: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.orderId, orderId),
        eq(transactionsTable.type, "refund"),
      ),
    );
  return (row?.total ?? 0) + 1;
}

/**
 * Initiates a buyer refund and closes the order as expired.
 * For orders that never collected payment, skips the provider call.
 */
export async function initiateOrderRefund(
  order: Order,
  actor: TransitionActor,
  options?: { amount?: string; skipStatusTransition?: boolean },
): Promise<Order> {
  const refundAmount = options?.amount ?? order.totalAmount;
  const skipStatus = options?.skipStatusTransition ?? false;

  const nextStatus = skipStatus
    ? order.status
    : applyTransition(order.status, "expired", actor);
  const attempt = await nextRefundAttempt(order.id);
  const reference = buildRefundReference(order.id, attempt);

  const [successfulCollection] = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.orderId, order.id),
        eq(transactionsTable.type, "collection"),
        eq(transactionsTable.status, "succeeded"),
      ),
    )
    .limit(1);

  await db.transaction(async (tx) => {
    if (successfulCollection) {
      await tx.insert(transactionsTable).values({
        orderId: order.id,
        type: "refund",
        moolreReference: reference,
        status: "pending",
        amount: refundAmount,
      });
    }
    if (!skipStatus) {
      await tx
        .update(ordersTable)
        .set({ status: nextStatus })
        .where(eq(ordersTable.id, order.id));
    }
  });

  if (successfulCollection) {
    try {
      const refund = await paymentProvider.refund({
        orderId: order.id,
        amount: refundAmount,
        reference,
      });

      if (refund.status === "succeeded") {
        await db
          .update(transactionsTable)
          .set({ status: "succeeded" })
          .where(
            and(
              eq(transactionsTable.orderId, order.id),
              eq(transactionsTable.moolreReference, reference),
            ),
          );
      }
    } catch (err) {
      logger.error(
        { orderId: order.id, reference, err },
        "Refund API call failed; order marked expired",
      );
    }
  }

  const [updated] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, order.id));
  if (!updated) {
    throw new Error(`Order ${order.id} not found after refund initiation`);
  }
  return updated;
}

export { InvalidOrderTransitionError };
