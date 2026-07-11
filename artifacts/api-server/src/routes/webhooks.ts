import { Router, type IRouter, type Request, type Response } from "express";
import {
  HandlePaymentWebhookBody,
  HandlePaymentWebhookResponse,
  HandleDisbursementWebhookBody,
  HandleDisbursementWebhookResponse,
} from "@workspace/api-zod";
import {
  applyCollectionWebhook,
  applyDisbursementWebhook,
} from "../lib/webhookHandlers";
import { parseOrderIdFromReference } from "../lib/paymentReferences";
import { verifyMoolreWebhookSignature } from "../lib/moolreWebhookVerify";

const router: IRouter = Router();

async function handlePaymentWebhook(req: Request, res: Response): Promise<void> {
  if (!verifyMoolreWebhookSignature(req)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const parsed = HandlePaymentWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { orderId, moolreReference, status } = parsed.data;

  const resolvedOrderId =
    orderId ?? parseOrderIdFromReference(moolreReference) ?? undefined;

  if (resolvedOrderId == null) {
    req.log.warn({ moolreReference }, "Payment webhook: unresolvable order reference");
    res.json(HandlePaymentWebhookResponse.parse({ received: true }));
    return;
  }

  await applyCollectionWebhook({
    orderId: resolvedOrderId,
    moolreReference,
    status,
  });

  res.json(HandlePaymentWebhookResponse.parse({ received: true }));
}

async function handleDisbursementWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  if (!verifyMoolreWebhookSignature(req)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const parsed = HandleDisbursementWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { orderId, moolreReference, status } = parsed.data;

  const resolvedOrderId =
    orderId ?? parseOrderIdFromReference(moolreReference) ?? undefined;

  if (resolvedOrderId == null) {
    req.log.warn({ moolreReference }, "Disbursement webhook: unresolvable order reference");
    res.json(HandleDisbursementWebhookResponse.parse({ received: true }));
    return;
  }

  await applyDisbursementWebhook({
    orderId: resolvedOrderId,
    moolreReference,
    status,
  });

  res.json(HandleDisbursementWebhookResponse.parse({ received: true }));
}

router.post("/webhooks/payments", handlePaymentWebhook);
router.post("/webhooks/moolre/collections", handlePaymentWebhook);

router.post("/webhooks/disbursements", handleDisbursementWebhook);
router.post("/webhooks/moolre/disbursements", handleDisbursementWebhook);

export default router;
