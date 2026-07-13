/** Client-side Ghana phone validation (mirrors API rules). */

export function normalizeGhanaPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");

  if (digits.startsWith("+233") && /^\+233[235]\d{8}$/.test(digits)) {
    return digits;
  }
  if (digits.startsWith("233") && digits.length === 12) {
    const normalized = `+${digits}`;
    return /^\+233[235]\d{8}$/.test(normalized) ? normalized : null;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    const normalized = `+233${digits.slice(1)}`;
    return /^\+233[235]\d{8}$/.test(normalized) ? normalized : null;
  }
  if (/^[235]\d{8}$/.test(digits)) {
    return `+233${digits}`;
  }
  return null;
}

export function ghanaPhoneSchema(message = "Enter a valid Ghana mobile number") {
  return (value: string) => normalizeGhanaPhone(value) !== null || message;
}

export function normalizeMomoNumber(input: string): string | null {
  const phone = normalizeGhanaPhone(input);
  if (!phone) return null;
  return `0${phone.slice(4)}`;
}

export type MomoProviderId = "mtn" | "telecel" | "airteltigo";

export function momoProviderLabel(provider: MomoProviderId): string {
  switch (provider) {
    case "mtn":
      return "MTN";
    case "telecel":
      return "Telecel";
    case "airteltigo":
      return "AirtelTigo";
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

/**
 * Infer network from Ghana MoMo number prefixes for form prefills / validation.
 * Telecel: 020, 050 — AirtelTigo: 026, 027, 056, 057 — otherwise MTN
 * (024, 025, 053, 054, 055, 059, …).
 */
export function inferMomoProvider(phone: string): MomoProviderId {
  const local = normalizeMomoNumber(phone);
  if (!local) return "mtn";
  const prefix = local.slice(0, 3);
  if (prefix === "020" || prefix === "050") return "telecel";
  if (prefix === "026" || prefix === "027" || prefix === "056" || prefix === "057") {
    return "airteltigo";
  }
  return "mtn";
}

/** True when the selected network matches the phone number's prefix. */
export function momoProviderMatchesPhone(
  phone: string,
  provider: MomoProviderId,
): boolean {
  if (!normalizeMomoNumber(phone)) return false;
  return inferMomoProvider(phone) === provider;
}

/** UX error when selected network does not match the MoMo number. */
export function momoProviderMismatchMessage(
  phone: string,
  provider: MomoProviderId,
): string | null {
  if (momoProviderMatchesPhone(phone, provider)) return null;
  const inferred = inferMomoProvider(phone);
  return `The number you entered looks like ${momoProviderLabel(inferred)}, but you selected ${momoProviderLabel(provider)}. Choose the matching network or correct the number.`;
}

export const ACTIVE_ROLE_STORAGE_KEY = "tradeshield_active_role";

export type ActiveRole = "buyer" | "supplier";

export function readStoredActiveRole(): ActiveRole | null {
  const value = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
  if (value === "buyer" || value === "supplier") return value;
  return null;
}

export function storeActiveRole(role: ActiveRole): void {
  localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
}
