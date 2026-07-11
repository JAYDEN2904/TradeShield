import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { logger } from "./logger";

export type RequestWithRawBody = Request & { rawBody?: Buffer };

const SIGNATURE_HEADER = "x-moolre-signature";

/**
 * Verifies Moolre webhook HMAC-SHA256 signature when MOOLRE_WEBHOOK_SECRET is set.
 * Skips verification in dev/mock mode (secret unset) with a logged warning.
 */
export function verifyMoolreWebhookSignature(req: RequestWithRawBody): boolean {
  const secret = process.env.MOOLRE_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("MOOLRE_WEBHOOK_SECRET not set — webhook signature verification skipped");
    return true;
  }

  const signature = req.headers[SIGNATURE_HEADER];
  if (typeof signature !== "string" || !signature.trim()) {
    logger.warn("Webhook missing signature header");
    return false;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.warn("Webhook raw body unavailable for signature verification");
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signature.trim().replace(/^sha256=/i, "");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(received, "hex");
    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return expected === received;
  }
}
