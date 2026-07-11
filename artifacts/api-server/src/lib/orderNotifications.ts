import { eq } from "drizzle-orm";
import { db, ordersTable, usersTable, type Order } from "@workspace/db";
import { formatOrderId } from "./formatOrderId";
import { sendSmsFireAndForget, type SmsTemplate } from "./smsProvider";
import { logger } from "./logger";

function formatGhs(amount: string | number): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `GHS ${n.toFixed(2)}`;
}

async function loadPartyPhones(order: Order): Promise<{
  buyerPhone?: string;
  supplierPhone?: string;
}> {
  const [buyer] = await db
    .select({ phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.id, order.buyerId));
  const [supplier] = await db
    .select({ phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.id, order.supplierId));
  return { buyerPhone: buyer?.phone, supplierPhone: supplier?.phone };
}

function dispatch(
  to: string | undefined,
  template: SmsTemplate,
  body: string,
  orderId?: number,
): void {
  if (!to) {
    logger.warn({ template, orderId }, "SMS skipped — missing phone number");
    return;
  }
  sendSmsFireAndForget({ to, template, body, orderId });
}

export async function notifyOrderCreated(order: Order): Promise<void> {
  const { supplierPhone } = await loadPartyPhones(order);
  dispatch(
    supplierPhone,
    "order_created",
    `TradeShield: New order ${formatOrderId(order.id)} for ${formatGhs(order.totalAmount)}. Open the app to accept or reject.`,
    order.id,
  );
}

export async function notifyOrderAccepted(order: Order): Promise<void> {
  const { buyerPhone } = await loadPartyPhones(order);
  dispatch(
    buyerPhone,
    "order_accepted",
    `TradeShield: Order ${formatOrderId(order.id)} accepted. Pay ${formatGhs(order.totalAmount)} to secure funds in escrow.`,
    order.id,
  );
}

export async function notifyOrderRejected(
  order: Order,
  reason?: string | null,
): Promise<void> {
  const { buyerPhone } = await loadPartyPhones(order);
  const suffix = reason ? ` Reason: ${reason}` : "";
  dispatch(
    buyerPhone,
    "order_rejected",
    `TradeShield: Order ${formatOrderId(order.id)} was rejected.${suffix}`,
    order.id,
  );
}

export async function notifyPaymentInEscrow(order: Order): Promise<void> {
  const { supplierPhone } = await loadPartyPhones(order);
  dispatch(
    supplierPhone,
    "payment_escrow",
    `TradeShield: ${formatGhs(order.totalAmount)} secured in escrow for order ${formatOrderId(order.id)}. Safe to ship when ready.`,
    order.id,
  );
}

export async function notifyOrderShipped(order: Order): Promise<void> {
  const { buyerPhone } = await loadPartyPhones(order);
  dispatch(
    buyerPhone,
    "order_shipped",
    `TradeShield: Order ${formatOrderId(order.id)} has shipped. Confirm receipt in the app when goods arrive.`,
    order.id,
  );
}

export async function notifyAutoReleaseReminder(order: Order): Promise<void> {
  const { buyerPhone } = await loadPartyPhones(order);
  dispatch(
    buyerPhone,
    "auto_release_reminder",
    `TradeShield: Order ${formatOrderId(order.id)} auto-releases in ~24 hours. Confirm receipt or raise a dispute in the app.`,
    order.id,
  );
}

export async function notifyPayoutCompleted(order: Order): Promise<void> {
  const payout = Number(order.totalAmount) - Number(order.platformFee);
  const { supplierPhone } = await loadPartyPhones(order);
  dispatch(
    supplierPhone,
    "payout_completed",
    `TradeShield: ${formatGhs(payout)} paid out for order ${formatOrderId(order.id)}. Check your mobile money wallet.`,
    order.id,
  );
}

export async function notifyPayoutFailed(order: Order): Promise<void> {
  const { supplierPhone } = await loadPartyPhones(order);
  dispatch(
    supplierPhone,
    "payout_failed",
    `TradeShield: Payout for order ${formatOrderId(order.id)} failed. Please verify your MoMo number in Settings.`,
    order.id,
  );
}

export async function notifyDisputeOpened(order: Order): Promise<void> {
  const { buyerPhone, supplierPhone } = await loadPartyPhones(order);
  const body = `TradeShield: Order ${formatOrderId(order.id)} is under dispute review. Escrow release is paused.`;
  dispatch(buyerPhone, "dispute_opened", body, order.id);
  dispatch(supplierPhone, "dispute_opened", body, order.id);
}

export async function notifyDisputeResolved(
  order: Order,
  resolution: string,
): Promise<void> {
  const { buyerPhone, supplierPhone } = await loadPartyPhones(order);
  const body = `TradeShield: Dispute on order ${formatOrderId(order.id)} resolved. ${resolution}`;
  dispatch(buyerPhone, "dispute_resolved", body, order.id);
  dispatch(supplierPhone, "dispute_resolved", body, order.id);
}

export async function notifyOrderExpired(order: Order): Promise<void> {
  const { buyerPhone } = await loadPartyPhones(order);
  dispatch(
    buyerPhone,
    "order_expired",
    `TradeShield: Order ${formatOrderId(order.id)} expired without supplier confirmation. You can place a new order anytime.`,
    order.id,
  );
}

export function notifyOtp(phone: string, code: string): void {
  dispatch(
    phone,
    "otp",
    `TradeShield: Your verification code is ${code}. Valid for 5 minutes.`,
  );
}

export function fireAndForget(promise: Promise<void>, label: string): void {
  promise.catch((err) => {
    logger.error({ err, label }, "Order notification failed");
  });
}
