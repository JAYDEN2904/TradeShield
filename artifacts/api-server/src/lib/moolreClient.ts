/**
 * Low-level Moolre HTTP helpers: auth headers, MSISDN/channel mapping,
 * and response status interpretation.
 */

import { normalizeGhanaPhone, normalizeMomoNumber } from "./phoneValidation";
import type { ProviderTransactionStatus } from "./paymentProvider";
import type { MoolreCredentials } from "./moolreConfig";

export type MoolreAuthMode = "private" | "public" | "vas";
export type MoolreChannelPurpose = "payment" | "transfer";
export type MomoProvider = "mtn" | "telecel" | "airteltigo";

export type MoolreApiResponse = {
  status?: number | string;
  code?: string;
  message?: string | string[] | null;
  data?: unknown;
  go?: unknown;
};

export function channelForMomoProvider(
  provider: MomoProvider,
  purpose: MoolreChannelPurpose,
): string {
  switch (provider) {
    case "telecel":
      return "6";
    case "airteltigo":
      return "7";
    case "mtn":
      return purpose === "payment" ? "13" : "1";
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export function isMomoProvider(value: string): value is MomoProvider {
  return value === "mtn" || value === "telecel" || value === "airteltigo";
}

/** Infer network from Ghana MoMo number prefixes when the buyer does not pick one. */
export function inferMomoProvider(phone: string): MomoProvider {
  const normalized = normalizeGhanaPhone(phone);
  if (!normalized) return "mtn";

  const local = `0${normalized.slice(4)}`;
  const prefix = local.slice(0, 3);

  if (prefix === "020" || prefix === "050") return "telecel";
  if (prefix === "026" || prefix === "027" || prefix === "056" || prefix === "057") {
    return "airteltigo";
  }
  return "mtn";
}

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
  provider?: MomoProvider,
): string {
  const envDefault = process.env.MOOLRE_DEFAULT_MOMO_CHANNEL?.trim();
  if (envDefault) return envDefault;

  if (provider) {
    return channelForMomoProvider(provider, purpose);
  }

  return channelForMomoProvider(inferMomoProvider(phone), purpose);
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
