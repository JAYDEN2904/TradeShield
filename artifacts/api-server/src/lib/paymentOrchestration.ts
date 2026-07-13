import { eq, and, count, desc } from "drizzle-orm";
import {
  db,
  ordersTable,
  transactionsTable,
  usersTable,
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
import {
  PaymentInProgressError,
  PaymentOtpRequiredError,
  PaymentProviderRejectedError,
} from "./paymentErrors";
import { applyCollectionWebhook, applyDisbursementWebhook } from "./webhookHandlers";
import { logger } from "./logger";

export {
  PaymentInProgressError,
  PaymentOtpRequiredError,
  PaymentProviderRejectedError,
};

function isTransientProviderError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("socket hang up") ||
    err.name === "AbortError" ||
    err.name === "TimeoutError"
  );
}

function providerRejectionMessage(err: unknown, kind: "payment" | "payout"): string {
  if (!(err instanceof Error)) {
    return kind === "payment"
      ? "Payment could not be started. Please try again."
      : "Payout could not be started. Please try again.";
  }

  // Prefer Moolre's human-readable message when present: "...: TP04 — Account number..."
  const dashIdx = err.message.indexOf(" — ");
  if (dashIdx >= 0) {
    const detail = err.message.slice(dashIdx + 3).trim();
    if (detail) {
      // TP15 invalid OTP — keep the provider wording without the generic prefix noise.
      if (/verification code/i.test(detail) || /otp/i.test(detail)) {
        return detail;
      }
      return kind === "payment"
        ? `Payment could not be started: ${detail}`
        : `Payout could not be started: ${detail}`;
    }
  }

  const codeMatch = err.message.match(/\(([0-9]+)\):\s*([A-Z0-9]+)/i);
  if (codeMatch?.[2]) {
    return kind === "payment"
      ? `Payment could not be started (provider code ${codeMatch[2]}). Please try again or contact support.`
      : `Payout could not be started (provider code ${codeMatch[2]}). Please try again or contact support.`;
  }

  return kind === "payment"
    ? "Payment could not be started. Please try again."
    : "Payout could not be started. Please try again.";
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
 * Hard provider rejections roll back to awaiting_payment; only transient
 * network/timeouts leave the order in payment_processing for reconciliation.
 */
export async function initiateOrderCollection(
  order: Order,
  payerPhone: string,
  actor: TransitionActor = "buyer",
  options?: { otpCode?: string },
): Promise<Order> {
  if (order.status === "payment_processing") {
    const pending = await hasPendingCollection(order.id);
    if (pending) {
      throw new PaymentInProgressError(
        "A payment is already in progress for this order",
      );
    }
  }

  const otpCode = options?.otpCode?.trim() || undefined;
  let reference: string;

  if (otpCode) {
    // Moolre binds the SMS OTP to the original externalref. Reuse the latest
    // collection reference instead of minting a new one (which re-triggers TP14).
    const [lastCollection] = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.orderId, order.id),
          eq(transactionsTable.type, "collection"),
        ),
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(1);

    if (!lastCollection?.moolreReference) {
      throw new PaymentProviderRejectedError(
        "No verification in progress. Tap Pay again to receive a new SMS code.",
      );
    }

    reference = lastCollection.moolreReference;
    const nextStatus = applyTransition(
      order.status,
      "payment_processing",
      actor,
    );

    await db.transaction(async (tx) => {
      await tx
        .update(transactionsTable)
        .set({ status: "pending" })
        .where(eq(transactionsTable.id, lastCollection.id));
      await tx
        .update(ordersTable)
        .set({ status: nextStatus })
        .where(eq(ordersTable.id, order.id));
    });
  } else {
    const attempt = await nextCollectionAttempt(order.id);
    reference = buildCollectionReference(order.id, attempt);

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
  }

  try {
    const charge = await paymentProvider.charge({
      orderId: order.id,
      amount: order.totalAmount,
      payerPhone,
      reference,
      otpCode,
    });

    if (charge.reference !== reference) {
      logger.warn(
        { orderId: order.id, expected: reference, got: charge.reference },
        "Provider returned unexpected collection reference",
      );
    }

    // Provider accepted but already reported a terminal failure (no USSD pending).
    if (charge.status === "failed") {
      await applyCollectionWebhook({
        orderId: order.id,
        moolreReference: reference,
        status: "failed",
      });
      throw new PaymentProviderRejectedError(
        "Payment could not be started. Please try again.",
      );
    }

    // OTP verified the phone but did not open a MoMo/USSD session. Mark the
    // verify attempt failed and immediately start a fresh collection.
    if (charge.needsFollowUpCollection) {
      logger.warn(
        { orderId: order.id, reference },
        "OTP accepted without USSD; starting follow-up collection",
      );
      await applyCollectionWebhook({
        orderId: order.id,
        moolreReference: reference,
        status: "failed",
      });

      const [freshOrder] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, order.id));
      if (!freshOrder) {
        throw new Error(`Order ${order.id} not found before follow-up collection`);
      }

      return initiateOrderCollection(freshOrder, payerPhone, actor);
    }
  } catch (err) {
    if (err instanceof PaymentProviderRejectedError) {
      throw err;
    }

    if (err instanceof PaymentOtpRequiredError) {
      logger.warn(
        {
          orderId: order.id,
          reference,
          hadOtp: Boolean(otpCode),
        },
        "Collection requires OTP verification; rolling back to awaiting_payment",
      );
      await applyCollectionWebhook({
        orderId: order.id,
        moolreReference: reference,
        status: "failed",
      });
      throw err;
    }

    if (isTransientProviderError(err)) {
      // Timeout / network — leave payment_processing; polling/webhook resolves.
      logger.error(
        { orderId: order.id, reference, err },
        "Collection API call failed; order left in payment_processing for reconciliation",
      );
    } else {
      // Hard provider rejection (e.g. TP04) — roll back so the UI is not stuck forever.
      logger.error(
        { orderId: order.id, reference, err },
        "Collection API call rejected; rolling back to awaiting_payment",
      );
      await applyCollectionWebhook({
        orderId: order.id,
        moolreReference: reference,
        status: "failed",
      });
      throw new PaymentProviderRejectedError(
        providerRejectionMessage(err, "payment"),
      );
    }
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

    if (disburse.status === "failed") {
      await applyDisbursementWebhook({
        orderId: order.id,
        moolreReference: reference,
        status: "failed",
      });
      throw new PaymentProviderRejectedError(
        "Payout could not be started. Please try again.",
      );
    }
  } catch (err) {
    if (err instanceof PaymentProviderRejectedError) {
      throw err;
    }

    if (isTransientProviderError(err)) {
      logger.error(
        { orderId: order.id, reference, err },
        "Disbursement API call failed; order left in payout_processing for reconciliation",
      );
    } else {
      logger.error(
        { orderId: order.id, reference, err },
        "Disbursement API call rejected; rolling back from payout_processing",
      );
      await applyDisbursementWebhook({
        orderId: order.id,
        moolreReference: reference,
        status: "failed",
      });
      throw new PaymentProviderRejectedError(
        providerRejectionMessage(err, "payout"),
      );
    }
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
      const [buyer] = await db
        .select({ phone: usersTable.phone })
        .from(usersTable)
        .where(eq(usersTable.id, order.buyerId))
        .limit(1);

      const refund = await paymentProvider.refund({
        orderId: order.id,
        amount: refundAmount,
        reference,
        recipientPhone: buyer?.phone,
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
