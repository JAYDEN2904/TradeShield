import { Router, type IRouter, type Request, type Response } from "express";
import {
  HandlePaymentWebhookResponse,
  HandleDisbursementWebhookResponse,
} from "@workspace/api-zod";
import {
  applyCollectionWebhook,
  applyDisbursementWebhook,
} from "../lib/webhookHandlers";
import { normalizeMoolreWebhookPayload } from "../lib/moolreWebhookPayload";
import { verifyMoolreWebhookSignature } from "../lib/moolreWebhookVerify";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function applyNormalizedWebhook(
  req: Request,
  res: Response,
  hint?: "collection" | "disbursement",
): Promise<void> {
  if (!verifyMoolreWebhookSignature(req)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const normalized = normalizeMoolreWebhookPayload(req.body, hint);
  if (!normalized) {
    req.log.warn({ body: req.body }, "Unrecognized Moolre webhook payload");
    res.status(400).json({ error: "Unrecognized webhook payload" });
    return;
  }

  if (normalized.orderId == null) {
    req.log.warn(
      { moolreReference: normalized.moolreReference },
      "Webhook: unresolvable order reference",
    );
    res.json({ received: true });
    return;
  }

  const kind =
    normalized.kind === "unknown" && hint
      ? hint
      : normalized.kind === "refund"
        ? "disbursement"
        : normalized.kind;

  if (kind === "collection") {
    await applyCollectionWebhook({
      orderId: normalized.orderId,
      moolreReference: normalized.moolreReference,
      status: normalized.status,
    });
    res.json(HandlePaymentWebhookResponse.parse({ received: true }));
    return;
  }

  if (kind === "disbursement") {
    await applyDisbursementWebhook({
      orderId: normalized.orderId,
      moolreReference: normalized.moolreReference,
      status: normalized.status,
    });
    res.json(HandleDisbursementWebhookResponse.parse({ received: true }));
    return;
  }

  logger.warn(
    {
      kind: normalized.kind,
      reference: normalized.moolreReference,
      orderId: normalized.orderId,
    },
    "Webhook kind could not be routed",
  );
  res.json({ received: true });
}

async function handlePaymentWebhook(req: Request, res: Response): Promise<void> {
  await applyNormalizedWebhook(req, res, "collection");
}

async function handleDisbursementWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  await applyNormalizedWebhook(req, res, "disbursement");
}

/** Unified callback — Moolre account `callback` often points here for all events. */
async function handleUnifiedMoolreWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  await applyNormalizedWebhook(req, res);
}

router.post("/webhooks/payments", handlePaymentWebhook);
router.post("/webhooks/moolre/collections", handlePaymentWebhook);

router.post("/webhooks/disbursements", handleDisbursementWebhook);
router.post("/webhooks/moolre/disbursements", handleDisbursementWebhook);

router.post("/webhooks/moolre", handleUnifiedMoolreWebhook);

export default router;
