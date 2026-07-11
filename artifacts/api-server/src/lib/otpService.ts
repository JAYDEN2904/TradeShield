import { eq, and, gte, desc } from "drizzle-orm";
import { db, otpCodesTable } from "@workspace/db";

const RESEND_COOLDOWN_MS = 30 * 1000;
const RESEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_RESENDS_PER_WINDOW = 3;

export type OtpRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: string };

export async function checkOtpRateLimit(
  phone: string,
): Promise<OtpRateLimitResult> {
  const windowStart = new Date(Date.now() - RESEND_WINDOW_MS);

  const recent = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(eq(otpCodesTable.phone, phone), gte(otpCodesTable.createdAt, windowStart)),
    )
    .orderBy(desc(otpCodesTable.createdAt));

  if (recent.length >= MAX_RESENDS_PER_WINDOW) {
    const oldestInWindow = recent[recent.length - 1];
    const retryMs =
      oldestInWindow.createdAt.getTime() + RESEND_WINDOW_MS - Date.now();
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
      reason: "Too many OTP requests. Try again in a few minutes.",
    };
  }

  const latest = recent[0];
  if (latest) {
    const elapsed = Date.now() - latest.createdAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        allowed: false,
        retryAfterSeconds,
        reason: `Please wait ${retryAfterSeconds}s before requesting another code.`,
      };
    }
  }

  return { allowed: true };
}

export async function createOtpCode(input: {
  phone: string;
  purpose: "registration" | "password_reset";
}): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const OTP_TTL_MS = 5 * 60 * 1000;

  await db.insert(otpCodesTable).values({
    phone: input.phone,
    code,
    purpose: input.purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  return code;
}

export async function verifyOtpCode(input: {
  phone: string;
  code: string;
  purpose: "registration" | "password_reset";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [otp] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.phone, input.phone),
        eq(otpCodesTable.code, input.code),
        eq(otpCodesTable.used, false),
        eq(otpCodesTable.purpose, input.purpose),
      ),
    )
    .orderBy(desc(otpCodesTable.createdAt))
    .limit(1);

  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Invalid or expired code" };
  }

  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.id, otp.id));

  return { ok: true };
}

export async function hasVerifiedRegistrationOtp(phone: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.phone, phone),
        eq(otpCodesTable.used, true),
        eq(otpCodesTable.purpose, "registration"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export function requiresPayoutMomo(role: string): boolean {
  return role === "supplier" || role === "both";
}
