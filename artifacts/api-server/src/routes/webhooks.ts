import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ordersTable, transactionsTable } from "@workspace/db";
import {
  HandlePaymentWebhookBody,
  HandlePaymentWebhookResponse,
  HandleDisbursementWebhookBody,
  HandleDisbursementWebhookResponse,
} from "@workspace/api-zod";
import { applyTransition, InvalidOrderTransitionError } from "../lib/orderStateMachine";

const router: IRouter = Router();

// Mock Moolre Collections webhook. Idempotent: a duplicate delivery for the
// same moolreReference is a no-op if that reference has already been
// recorded with a terminal status.
router.post("/webhooks/payments", async (req, res): Promise<void> => {
  const parsed = HandlePaymentWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { orderId, moolreReference, status } = parsed.data;

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
    req.log.info({ orderId, moolreReference }, "Duplicate payment webhook ignored");
    res.json(HandlePaymentWebhookResponse.parse({ received: true }));
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    res.json(HandlePaymentWebhookResponse.parse({ received: true }));
    return;
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
    req.log.warn({ orderId, err: err.message }, "Payment webhook: invalid transition ignored");
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

  res.json(HandlePaymentWebhookResponse.parse({ received: true }));
});

// Mock Moolre Bulk Disbursement webhook. Same idempotency contract as above.
router.post("/webhooks/disbursements", async (req, res): Promise<void> => {
  const parsed = HandleDisbursementWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { orderId, moolreReference, status } = parsed.data;

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
    res.json(HandleDisbursementWebhookResponse.parse({ received: true }));
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    res.json(HandleDisbursementWebhookResponse.parse({ received: true }));
    return;
  }

  const targetStatus = status === "succeeded" ? "completed" : "payout_failed";

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
    req.log.warn({ orderId, err: err.message }, "Disbursement webhook: invalid transition ignored");
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
      amount: order.totalAmount,
    });
  }

  res.json(HandleDisbursementWebhookResponse.parse({ received: true }));
});

export default router;
