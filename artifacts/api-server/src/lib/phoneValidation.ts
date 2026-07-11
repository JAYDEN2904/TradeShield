/** Ghana mobile number normalization and validation (+233). */

const GHANA_E164 = /^\+233[235]\d{8}$/;

export function normalizeGhanaPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");

  if (digits.startsWith("+233")) {
    const normalized = digits;
    return GHANA_E164.test(normalized) ? normalized : null;
  }

  if (digits.startsWith("233") && digits.length === 12) {
    const normalized = `+${digits}`;
    return GHANA_E164.test(normalized) ? normalized : null;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    const normalized = `+233${digits.slice(1)}`;
    return GHANA_E164.test(normalized) ? normalized : null;
  }

  if (/^[235]\d{8}$/.test(digits)) {
    const normalized = `+233${digits}`;
    return GHANA_E164.test(normalized) ? normalized : null;
  }

  return null;
}

export function isValidGhanaPhone(input: string): boolean {
  return normalizeGhanaPhone(input) !== null;
}

/** Local display format e.g. 024 123 4567 */
export function formatGhanaPhoneDisplay(e164: string): string {
  if (!e164.startsWith("+233") || e164.length !== 13) return e164;
  const local = `0${e164.slice(4)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function normalizeMomoNumber(input: string): string | null {
  const phone = normalizeGhanaPhone(input);
  if (!phone) return null;
  return `0${phone.slice(4)}`;
}
