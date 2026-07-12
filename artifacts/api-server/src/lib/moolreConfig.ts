/**
 * Shared Moolre credential resolution from environment.
 * Sandbox: X-API-USER (+ optional keys). Live: user + private key required.
 */

export type MoolreCredentials = {
  baseUrl: string;
  apiUser: string;
  accountNumber: string;
  /** Private API key — required on live, optional on sandbox */
  apiKey?: string;
  /** Public API key — used for some status / link endpoints */
  apiPubKey?: string;
  vasKey?: string;
  smsSenderId: string;
  collectionsCallbackUrl: string;
  disbursementsCallbackUrl: string;
  isSandbox: boolean;
};

export function resolveMoolreCredentials(): MoolreCredentials | null {
  const apiUser =
    process.env.MOOLRE_API_USER?.trim() ||
    process.env.MOOLRE_SANDBOX_USER?.trim() ||
    "";
  const accountNumber = process.env.MOOLRE_ACCOUNT_NUMBER?.trim() || "";

  if (!apiUser || !accountNumber) {
    return null;
  }

  const apiKey =
    process.env.MOOLRE_API_KEY?.trim() ||
    process.env.MOOLRE_PRIVATE_KEY?.trim() ||
    undefined;
  const apiPubKey =
    process.env.MOOLRE_API_PUBKEY?.trim() ||
    process.env.MOOLRE_PUBLIC_KEY?.trim() ||
    process.env.MOOLRE_API_SECRET?.trim() ||
    undefined;

  const baseUrl = (
    process.env.MOOLRE_BASE_URL?.trim() || "https://sandbox.moolre.com"
  ).replace(/\/$/, "");

  const isSandbox = baseUrl.includes("sandbox.moolre.com");

  if (!isSandbox && !apiKey) {
    return null;
  }

  return {
    baseUrl,
    apiUser,
    accountNumber,
    apiKey,
    apiPubKey,
    vasKey: process.env.MOOLRE_VAS_KEY?.trim() || undefined,
    smsSenderId: process.env.MOOLRE_SMS_SENDER_ID?.trim() || "TradeShield",
    collectionsCallbackUrl:
      process.env.MOOLRE_COLLECTIONS_CALLBACK_URL?.trim() || "",
    disbursementsCallbackUrl:
      process.env.MOOLRE_DISBURSEMENTS_CALLBACK_URL?.trim() || "",
    isSandbox,
  };
}

/** True when real Moolre (not mock) is configured. */
export function isMoolreConfigured(): boolean {
  return resolveMoolreCredentials() !== null;
}
