/**
 * Low-level Moolre HTTP helpers: auth headers, MSISDN/channel mapping,
 * and response status interpretation.
 */

import { normalizeGhanaPhone, normalizeMomoNumber } from "./phoneValidation";
import type { ProviderTransactionStatus } from "./paymentProvider";
import type { MoolreCredentials } from "./moolreConfig";

export type MoolreAuthMode = "private" | "public" | "vas";
export type MoolreChannelPurpose = "payment" | "transfer";

export type MoolreApiResponse = {
  status?: number | string;
  code?: string;
  message?: string | string[] | null;
  data?: unknown;
  go?: unknown;
};

/** International digits for SMS / legacy callers, e.g. 233241234567 */
export function toMoolreMsisdn(phone: string): string {
  const normalized = normalizeGhanaPhone(phone);
  if (normalized) {
    return normalized.slice(1);
  }
  return phone.replace(/\D/g, "").replace(/^0/, "233");
}

/**
 * Local Ghana MoMo format Moolre payment/transfer APIs require:
 * start with 0, no country code — e.g. 0241234567
 */
export function toMoolreLocalPhone(phone: string): string {
  const local = normalizeMomoNumber(phone);
  if (local) return local;

  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return digits;
  }
  return digits;
}

/**
 * MoMo channel codes:
 * - Payment (collections): 13=MTN, 6=Telecel, 7=AT
 * - Transfer (disbursement): 1=MTN, 6=Telecel, 7=AT
 * Override via MOOLRE_DEFAULT_MOMO_CHANNEL when set.
 */
export function resolveMomoChannel(
  phone: string,
  purpose: MoolreChannelPurpose = "transfer",
): string {
  const envDefault = process.env.MOOLRE_DEFAULT_MOMO_CHANNEL?.trim();
  if (envDefault) return envDefault;

  const normalized = normalizeGhanaPhone(phone);
  const mtnDefault = purpose === "payment" ? "13" : "1";
  if (!normalized) return mtnDefault;

  const local = `0${normalized.slice(4)}`;
  const prefix = local.slice(0, 3);

  // Telecel (Vodafone)
  if (prefix === "020" || prefix === "050") return "6";
  // AT (AirtelTigo)
  if (prefix === "026" || prefix === "027" || prefix === "056" || prefix === "057") {
    return "7";
  }
  // MTN (024, 054, 055, 059, 025, 053, …)
  return mtnDefault;
}

export function buildMoolreHeaders(
  creds: Pick<MoolreCredentials, "apiUser" | "apiKey" | "apiPubKey" | "vasKey" | "isSandbox">,
  mode: MoolreAuthMode = "private",
): Record<string, string> {
  if (mode === "vas") {
    const vasHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (creds.vasKey) {
      vasHeaders["X-API-VASKEY"] = creds.vasKey;
    }
    return vasHeaders;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-USER": creds.apiUser,
  };

  if (creds.isSandbox) {
    // Sandbox: only X-API-USER required; still send keys when present.
    if (mode === "public" && creds.apiPubKey) {
      headers["X-API-PUBKEY"] = creds.apiPubKey;
    } else if (creds.apiKey) {
      headers["X-API-KEY"] = creds.apiKey;
    }
    return headers;
  }

  if (mode === "public") {
    if (creds.apiPubKey) {
      headers["X-API-PUBKEY"] = creds.apiPubKey;
    }
  } else if (creds.apiKey) {
    headers["X-API-KEY"] = creds.apiKey;
  }

  return headers;
}

export function isMoolreSuccessStatus(status: number | string | undefined): boolean {
  return status === 1 || status === "1";
}

export function mapMoolreTxStatus(
  raw: unknown,
): ProviderTransactionStatus {
  if (raw === 1 || raw === "1" || raw === true) return "succeeded";
  if (raw === 0 || raw === "0" || raw === false) return "failed";

  if (typeof raw === "string") {
    const value = raw.toLowerCase();
    if (
      value === "successful" ||
      value === "succeeded" ||
      value === "success" ||
      value === "paid" ||
      value === "completed"
    ) {
      return "succeeded";
    }
    if (value === "failed" || value === "failure" || value === "declined") {
      return "failed";
    }
  }

  return "pending";
}

/** Interpret a status-poll or initiate response into our provider status. */
export function interpretMoolreTransactionResponse(
  body: MoolreApiResponse,
): ProviderTransactionStatus {
  const code = (body.code ?? "").toUpperCase();

  // Explicit success codes from docs
  if (code === "SS01" || code === "OBGH01" || code === "P01") {
    const data = body.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const tx = data as Record<string, unknown>;
      if ("txstatus" in tx) {
        return mapMoolreTxStatus(tx.txstatus);
      }
    }
    return isMoolreSuccessStatus(body.status) ? "succeeded" : "pending";
  }

  // Payment request accepted — USSD pending approval
  if (code === "TR099" || code === "TP14") {
    return "pending";
  }

  if (!isMoolreSuccessStatus(body.status)) {
    return "failed";
  }

  const data = body.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const tx = data as Record<string, unknown>;
    if ("txstatus" in tx) {
      return mapMoolreTxStatus(tx.txstatus);
    }
  }

  return "pending";
}

export function extractProviderTransactionId(
  body: MoolreApiResponse,
): string | undefined {
  const data = body.data;
  if (typeof data === "string" && data.trim()) {
    const trimmed = data.trim();
    // Moolre often returns placeholder strings like "all" / "address" that are
    // not real transaction IDs (especially on TP14/TP17 verification responses).
    if (
      trimmed.toLowerCase() === "all" ||
      trimmed.toLowerCase() === "address" ||
      trimmed.toLowerCase() === "otpcode" ||
      trimmed.toLowerCase() === "externalref"
    ) {
      return undefined;
    }
    return trimmed;
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const tx = data as Record<string, unknown>;
    const id = tx.transactionid ?? tx.transactionId ?? tx.thirdpartyref;
    if (typeof id === "string" || typeof id === "number") {
      return String(id);
    }
  }
  return undefined;
}

export async function moolreFetch(
  creds: MoolreCredentials,
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    authMode?: MoolreAuthMode;
  } = {},
): Promise<{ ok: boolean; httpStatus: number; body: MoolreApiResponse; text: string }> {
  const method = options.method ?? "POST";
  const response = await fetch(`${creds.baseUrl}${path}`, {
    method,
    headers: buildMoolreHeaders(creds, options.authMode ?? "private"),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body: MoolreApiResponse = {};
  try {
    body = text ? (JSON.parse(text) as MoolreApiResponse) : {};
  } catch {
    body = { status: 0, message: text.slice(0, 200) };
  }

  return {
    ok: response.ok && isMoolreSuccessStatus(body.status),
    httpStatus: response.status,
    body,
    text,
  };
}
