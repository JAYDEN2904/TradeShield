import { eq } from "drizzle-orm";
import { db, usersTable, type Order } from "@workspace/db";
import { formatOrderId } from "./formatOrderId";
import { sendSmsFireAndForget, type SmsTemplate } from "./smsProvider";
import { orderViewLinkSuffix } from "./appPublicUrl";
import { createNotification } from "./notifications";
import { logger } from "./logger";

function formatGhs(amount: string | number): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `GHS ${n.toFixed(2)}`;
}

async function loadParties(order: Order): Promise<{
  buyerId: number;
  supplierId: number;
  buyerPhone?: string;
  supplierPhone?: string;
}> {
  const [buyer] = await db
    .select({ id: usersTable.id, phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.id, order.buyerId));
  const [supplier] = await db
    .select({ id: usersTable.id, phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.id, order.supplierId));
  return {
    buyerId: order.buyerId,
    supplierId: order.supplierId,
    buyerPhone: buyer?.phone,
    supplierPhone: supplier?.phone,
  };
}

function dispatchSms(
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

function notifyInApp(input: {
  userId: number;
  type: string;
  title: string;
  body: string;
  orderId: number;
}): void {
  createNotification({
    ...input,
    link: `/orders/${input.orderId}`,
  }).catch((err) => {
    logger.error({ err, type: input.type }, "In-app notification failed");
  });
}

export async function notifyOrderCreated(order: Order): Promise<void> {
  const { supplierId, supplierPhone } = await loadParties(order);
  const smsBody = `TradeShield: New order ${formatOrderId(order.id)} for ${formatGhs(order.totalAmount)}. Open the app to accept or reject.${orderViewLinkSuffix(order.id)}`;
  dispatchSms(supplierPhone, "order_created", smsBody, order.id);
  notifyInApp({
    userId: supplierId,
    type: "order_created",
    title: "New order",
    body: `New order ${formatOrderId(order.id)} for ${formatGhs(order.totalAmount)}. Accept or reject to continue.`,
    orderId: order.id,
  });
}

export async function notifyOrderAccepted(order: Order): Promise<void> {
  const { buyerId, buyerPhone } = await loadParties(order);
  const smsBody = `TradeShield: Order ${formatOrderId(order.id)} accepted. Pay ${formatGhs(order.totalAmount)} to secure funds in escrow.${orderViewLinkSuffix(order.id)}`;
  dispatchSms(buyerPhone, "order_accepted", smsBody, order.id);
  notifyInApp({
    userId: buyerId,
    type: "order_accepted",
    title: "Order accepted — payment due",
    body: `Order ${formatOrderId(order.id)} accepted. Pay ${formatGhs(order.totalAmount)} to secure funds in escrow.`,
    orderId: order.id,
  });
}

export async function notifyOrderRejected(
  order: Order,
  reason?: string | null,
): Promise<void> {
  const { buyerId, buyerPhone } = await loadParties(order);
  const suffix = reason ? ` Reason: ${reason}` : "";
  const smsBody = `TradeShield: Order ${formatOrderId(order.id)} was rejected.${suffix}${orderViewLinkSuffix(order.id)}`;
  dispatchSms(buyerPhone, "order_rejected", smsBody, order.id);
  notifyInApp({
    userId: buyerId,
    type: "order_rejected",
    title: "Order rejected",
    body: `Order ${formatOrderId(order.id)} was rejected.${suffix}`,
    orderId: order.id,
  });
}

export async function notifyPaymentInEscrow(order: Order): Promise<void> {
  const { supplierId, supplierPhone } = await loadParties(order);
  const smsBody = `TradeShield: ${formatGhs(order.totalAmount)} secured in escrow for order ${formatOrderId(order.id)}. Safe to ship when ready.${orderViewLinkSuffix(order.id)}`;
  dispatchSms(supplierPhone, "payment_escrow", smsBody, order.id);
  notifyInApp({
    userId: supplierId,
    type: "payment_escrow",
    title: "Payment in escrow",
    body: `${formatGhs(order.totalAmount)} secured for order ${formatOrderId(order.id)}. Safe to ship when ready.`,
    orderId: order.id,
  });
}

export async function notifyOrderShipped(order: Order): Promise<void> {
  const { buyerId, buyerPhone } = await loadParties(order);
  const smsBody = `TradeShield: Order ${formatOrderId(order.id)} has shipped. Confirm receipt in the app when goods arrive.${orderViewLinkSuffix(order.id)}`;
  dispatchSms(buyerPhone, "order_shipped", smsBody, order.id);
  notifyInApp({
    userId: buyerId,
    type: "order_shipped",
    title: "Order shipped",
    body: `Order ${formatOrderId(order.id)} has shipped. Confirm receipt when goods arrive.`,
    orderId: order.id,
  });
}

export async function notifyAutoReleaseReminder(order: Order): Promise<void> {
  const { buyerId, buyerPhone } = await loadParties(order);
  const smsBody = `TradeShield: Order ${formatOrderId(order.id)} auto-releases in ~24 hours. Confirm receipt or raise a dispute in the app.${orderViewLinkSuffix(order.id)}`;
  dispatchSms(buyerPhone, "auto_release_reminder", smsBody, order.id);
  notifyInApp({
    userId: buyerId,
    type: "auto_release_reminder",
    title: "Auto-release reminder",
    body: `Order ${formatOrderId(order.id)} auto-releases in ~24 hours. Confirm receipt or raise a dispute.`,
    orderId: order.id,
  });
}

export async function notifyPayoutCompleted(order: Order): Promise<void> {
  const payout = Number(order.totalAmount) - Number(order.platformFee);
  const { supplierId, supplierPhone } = await loadParties(order);
  const smsBody = `TradeShield: ${formatGhs(payout)} paid out for order ${formatOrderId(order.id)}. Check your mobile money wallet.${orderViewLinkSuffix(order.id)}`;
  dispatchSms(supplierPhone, "payout_completed", smsBody, order.id);
  notifyInApp({
    userId: supplierId,
    type: "payout_completed",
    title: "Payout completed",
    body: `${formatGhs(payout)} paid out for order ${formatOrderId(order.id)}. Check your mobile money wallet.`,
    orderId: order.id,
  });
}

export async function notifyPayoutFailed(order: Order): Promise<void> {
  const { supplierId, supplierPhone } = await loadParties(order);
  const smsBody = `TradeShield: Payout for order ${formatOrderId(order.id)} failed. Please verify your MoMo number in Settings.${orderViewLinkSuffix(order.id)}`;
  dispatchSms(supplierPhone, "payout_failed", smsBody, order.id);
  notifyInApp({
    userId: supplierId,
    type: "payout_failed",
    title: "Payout failed",
    body: `Payout for order ${formatOrderId(order.id)} failed. Verify your MoMo number in Settings.`,
    orderId: order.id,
  });
}

export async function notifyDisputeOpened(order: Order): Promise<void> {
  const { buyerId, supplierId, buyerPhone, supplierPhone } =
    await loadParties(order);
  const smsBody = `TradeShield: Order ${formatOrderId(order.id)} is under dispute review. Escrow release is paused.${orderViewLinkSuffix(order.id)}`;
  const title = "Dispute opened";
  const body = `Order ${formatOrderId(order.id)} is under dispute review. Escrow release is paused.`;
  dispatchSms(buyerPhone, "dispute_opened", smsBody, order.id);
  dispatchSms(supplierPhone, "dispute_opened", smsBody, order.id);
  notifyInApp({
    userId: buyerId,
    type: "dispute_opened",
    title,
    body,
    orderId: order.id,
  });
  notifyInApp({
    userId: supplierId,
    type: "dispute_opened",
    title,
    body,
    orderId: order.id,
  });
}

export async function notifyDisputeResolved(
  order: Order,
  resolution: string,
): Promise<void> {
  const { buyerId, supplierId, buyerPhone, supplierPhone } =
    await loadParties(order);
  const smsBody = `TradeShield: Dispute on order ${formatOrderId(order.id)} resolved. ${resolution}${orderViewLinkSuffix(order.id)}`;
  const title = "Dispute resolved";
  const body = `Dispute on order ${formatOrderId(order.id)} resolved. ${resolution}`;
  dispatchSms(buyerPhone, "dispute_resolved", smsBody, order.id);
  dispatchSms(supplierPhone, "dispute_resolved", smsBody, order.id);
  notifyInApp({
    userId: buyerId,
    type: "dispute_resolved",
    title,
    body,
    orderId: order.id,
  });
  notifyInApp({
    userId: supplierId,
    type: "dispute_resolved",
    title,
    body,
    orderId: order.id,
  });
}

export async function notifyOrderExpired(order: Order): Promise<void> {
  const { buyerId, buyerPhone } = await loadParties(order);
  const smsBody = `TradeShield: Order ${formatOrderId(order.id)} expired without supplier confirmation. You can place a new order anytime.${orderViewLinkSuffix(order.id)}`;
  dispatchSms(buyerPhone, "order_expired", smsBody, order.id);
  notifyInApp({
    userId: buyerId,
    type: "order_expired",
    title: "Order expired",
    body: `Order ${formatOrderId(order.id)} expired without supplier confirmation. You can place a new order anytime.`,
    orderId: order.id,
  });
}

export function notifyOtp(phone: string, code: string): void {
  dispatchSms(
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
