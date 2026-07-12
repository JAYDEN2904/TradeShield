/**
 * Normalizes Moolre webhook payloads (and legacy mock shapes) into the
 * internal webhook handler contract.
 */

import {
  parseOrderIdFromReference,
} from "./paymentReferences";
import type { WebhookOutcome } from "./webhookHandlers";
import { mapMoolreTxStatus } from "./moolreClient";

export type NormalizedMoolreWebhook = {
  kind: "collection" | "disbursement" | "refund" | "unknown";
  orderId?: number;
  moolreReference: string;
  status: WebhookOutcome;
  providerTransactionId?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function inferKindFromReference(
  reference: string,
): NormalizedMoolreWebhook["kind"] {
  if (/ORDER-\d+-PAY-\d+/i.test(reference)) return "collection";
  if (/ORDER-\d+-PAYOUT-\d+/i.test(reference)) return "disbursement";
  if (/ORDER-\d+-REFUND-\d+/i.test(reference)) return "refund";
  return "unknown";
}

function inferKindFromTxType(
  txtype: unknown,
): NormalizedMoolreWebhook["kind"] | null {
  // Observed in list-transactions samples: txtype 1 ≈ inbound, 2 ≈ outbound
  if (txtype === 1 || txtype === "1") return "collection";
  if (txtype === 2 || txtype === "2") return "disbursement";
  return null;
}

function mapWebhookOutcome(input: {
  topStatus?: unknown;
  code?: unknown;
  txstatus?: unknown;
  statusString?: unknown;
}): WebhookOutcome | null {
  if (input.statusString === "succeeded" || input.statusString === "failed") {
    return input.statusString;
  }

  if (input.txstatus !== undefined) {
    const mapped = mapMoolreTxStatus(input.txstatus);
    if (mapped === "succeeded" || mapped === "failed") return mapped;
  }

  const code = typeof input.code === "string" ? input.code.toUpperCase() : "";
  if (code === "P01" || code === "SS01" || code === "OBGH01") {
    return "succeeded";
  }

  if (input.topStatus === 1 || input.topStatus === "1") {
    // Success envelope without explicit failure → treat as succeeded when P01-like
    if (!code || code.startsWith("P") || code === "SS01") {
      return "succeeded";
    }
  }

  if (input.topStatus === 0 || input.topStatus === "0") {
    return "failed";
  }

  const mappedTop = mapMoolreTxStatus(input.topStatus);
  if (mappedTop === "succeeded" || mappedTop === "failed") return mappedTop;

  return null;
}

/**
 * Accepts:
 * - Legacy mock: `{ moolreReference, status, orderId? }`
 * - Moolre native: `{ status, code, message, data: { externalref, txstatus, ... } }`
 */
export function normalizeMoolreWebhookPayload(
  raw: unknown,
  hint?: "collection" | "disbursement",
): NormalizedMoolreWebhook | null {
  const root = asRecord(raw);
  if (!root) return null;

  // Legacy / internal mock shape
  const legacyRef = pickString(root.moolreReference);
  const legacyStatus = root.status;
  if (
    legacyRef &&
    (legacyStatus === "succeeded" || legacyStatus === "failed")
  ) {
    const orderId =
      typeof root.orderId === "number"
        ? root.orderId
        : parseOrderIdFromReference(legacyRef) ?? undefined;
    return {
      kind: hint ?? inferKindFromReference(legacyRef),
      orderId,
      moolreReference: legacyRef,
      status: legacyStatus,
    };
  }

  const data = asRecord(root.data) ?? {};
  const moolreReference = pickString(
    data.externalref,
    data.externalRef,
    data.thirdpartyref,
    root.externalref,
    root.externalRef,
    root.reference,
    data.reference,
  );

  if (!moolreReference) {
    return null;
  }

  const status = mapWebhookOutcome({
    topStatus: root.status,
    code: root.code,
    txstatus: data.txstatus ?? data.txStatus,
    statusString: typeof root.status === "string" ? root.status : undefined,
  });

  if (!status) {
    return null;
  }

  const kindFromRef = inferKindFromReference(moolreReference);
  const kind =
    hint ??
    (kindFromRef !== "unknown"
      ? kindFromRef
      : inferKindFromTxType(data.txtype) ?? "unknown");

  const orderId =
    typeof root.orderId === "number"
      ? root.orderId
      : parseOrderIdFromReference(moolreReference) ?? undefined;

  return {
    kind,
    orderId,
    moolreReference,
    status,
    providerTransactionId: pickString(
      data.transactionid,
      data.transactionId,
      data.thirdpartyref,
    ),
  };
}
