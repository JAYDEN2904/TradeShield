/**
 * Polling fallback for payment/disbursement transactions stuck in pending.
 * Webhooks can be delayed or dropped — this job reconciles provider status
 * for any order still in payment_processing or payout_processing.
 */
import { eq, and, lt } from "drizzle-orm";
import { db, ordersTable, transactionsTable } from "@workspace/db";
import { paymentProvider } from "./paymentProvider";
import {
  applyCollectionWebhook,
  applyDisbursementWebhook,
} from "./webhookHandlers";
import { logger } from "./logger";

const CHECK_INTERVAL_MS =
  process.env.MOOLRE_API_KEY && process.env.MOOLRE_API_SECRET
    ? 30 * 1000
    : 5 * 1000;

const MIN_PENDING_AGE_MS =
  process.env.MOOLRE_API_KEY && process.env.MOOLRE_API_SECRET
    ? 2 * 60 * 1000
    : 2 * 1000;

async function reconcilePendingCollections(): Promise<void> {
  const cutoff = new Date(Date.now() - MIN_PENDING_AGE_MS);

  const pendingTxns = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "collection"),
        eq(transactionsTable.status, "pending"),
        lt(transactionsTable.createdAt, cutoff),
      ),
    );

  for (const txn of pendingTxns) {
    if (!txn.moolreReference) continue;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, txn.orderId));

    if (!order || order.status !== "payment_processing") continue;

    try {
      const providerStatus = await paymentProvider.getCollectionStatus(
        txn.moolreReference,
      );

      if (providerStatus === "pending") continue;

      await applyCollectionWebhook({
        orderId: txn.orderId,
        moolreReference: txn.moolreReference,
        status: providerStatus === "succeeded" ? "succeeded" : "failed",
      });

      logger.info(
        { orderId: txn.orderId, reference: txn.moolreReference, providerStatus },
        "Reconciled pending collection via polling",
      );
    } catch (err) {
      logger.error(
        { orderId: txn.orderId, reference: txn.moolreReference, err },
        "Collection reconciliation failed",
      );
    }
  }
}

async function reconcilePendingDisbursements(): Promise<void> {
  const cutoff = new Date(Date.now() - MIN_PENDING_AGE_MS);

  const pendingTxns = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "disbursement"),
        eq(transactionsTable.status, "pending"),
        lt(transactionsTable.createdAt, cutoff),
      ),
    );

  for (const txn of pendingTxns) {
    if (!txn.moolreReference) continue;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, txn.orderId));

    if (!order || order.status !== "payout_processing") continue;

    try {
      const providerStatus = await paymentProvider.getDisbursementStatus(
        txn.moolreReference,
      );

      if (providerStatus === "pending") continue;

      await applyDisbursementWebhook({
        orderId: txn.orderId,
        moolreReference: txn.moolreReference,
        status: providerStatus === "succeeded" ? "succeeded" : "failed",
      });

      logger.info(
        { orderId: txn.orderId, reference: txn.moolreReference, providerStatus },
        "Reconciled pending disbursement via polling",
      );
    } catch (err) {
      logger.error(
        { orderId: txn.orderId, reference: txn.moolreReference, err },
        "Disbursement reconciliation failed",
      );
    }
  }
}

async function reconcilePendingPayments(): Promise<void> {
  await reconcilePendingCollections();
  await reconcilePendingDisbursements();
}

let timer: NodeJS.Timeout | undefined;

export function startPaymentReconciliationJob(): void {
  if (timer) return;
  timer = setInterval(() => {
    reconcilePendingPayments().catch((err) => {
      logger.error({ err }, "Payment reconciliation tick failed");
    });
  }, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Payment reconciliation job started");
}

export function stopPaymentReconciliationJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

/** Exposed for tests */
export { reconcilePendingPayments };
