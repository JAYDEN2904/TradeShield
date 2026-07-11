import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  RequestOtpBody,
  RequestOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
  RegisterBody,
  RegisterResponse,
  LoginBody,
  LoginResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  GetCurrentUserResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { notifyOtp } from "../lib/orderNotifications";
import {
  normalizeGhanaPhone,
  normalizeMomoNumber,
} from "../lib/phoneValidation";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../lib/password";
import {
  checkOtpRateLimit,
  createOtpCode,
  verifyOtpCode,
  hasVerifiedRegistrationOtp,
  requiresPayoutMomo,
} from "../lib/otpService";

const router: IRouter = Router();

function parsePhone(raw: string): string | null {
  return normalizeGhanaPhone(raw);
}

function userWithoutSecrets<T extends { passwordHash?: string | null }>(
  user: T,
): Omit<T, "passwordHash"> {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const phone = parsePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid Ghana phone number (+233)" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid phone number or password" });
    return;
  }

  req.session.userId = user.id;
  res.json(LoginResponse.parse(userWithoutSecrets(user)));
});

router.post("/auth/request-otp", async (req, res): Promise<void> => {
  const parsed = RequestOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const phone = parsePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid Ghana phone number (+233)" });
    return;
  }

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phone, phone));

  if (existingUser) {
    res.status(400).json({
      error: "An account already exists for this number. Log in instead.",
    });
    return;
  }

  const rateLimit = await checkOtpRateLimit(phone);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: rateLimit.reason,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }

  const code = await createOtpCode({ phone, purpose: "registration" });
  req.log.info({ phone }, "Registration OTP requested");
  if (process.env.NODE_ENV !== "production") {
    req.log.info({ phone, code }, "OTP debug (dev only)");
  }
  notifyOtp(phone, code);

  res.json(
    RequestOtpResponse.parse({
      message: "Verification code sent",
    }),
  );
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const phone = parsePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid Ghana phone number (+233)" });
    return;
  }

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone));

  if (existingUser) {
    res.status(400).json({
      error: "An account already exists for this number. Log in instead.",
    });
    return;
  }

  const result = await verifyOtpCode({
    phone,
    code: parsed.data.code,
    purpose: "registration",
  });

  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json(
    VerifyOtpResponse.parse({
      verified: true,
      needsRegistration: true,
      user: null,
    }),
  );
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const phone = parsePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid Ghana phone number (+233)" });
    return;
  }

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phone, phone));

  if (!existingUser) {
    res.json(
      ForgotPasswordResponse.parse({
        message: "If an account exists, a reset code has been sent.",
      }),
    );
    return;
  }

  const rateLimit = await checkOtpRateLimit(phone);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: rateLimit.reason,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }

  const code = await createOtpCode({ phone, purpose: "password_reset" });
  if (process.env.NODE_ENV !== "production") {
    req.log.info({ phone, code }, "OTP debug (dev only)");
  }
  notifyOtp(phone, code);

  res.json(
    ForgotPasswordResponse.parse({
      message: "If an account exists, a reset code has been sent.",
    }),
  );
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const phone = parsePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid Ghana phone number (+233)" });
    return;
  }

  const passwordError = validatePasswordStrength(parsed.data.password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  const otpResult = await verifyOtpCode({
    phone,
    code: parsed.data.code,
    purpose: "password_reset",
  });

  if (!otpResult.ok) {
    res.status(400).json({ error: otpResult.error });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, user.id))
    .returning();

  if (!updated) {
    res.status(500).json({ error: "Failed to update password" });
    return;
  }

  req.session.userId = updated.id;
  res.json(ResetPasswordResponse.parse(userWithoutSecrets(updated)));
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const phone = parsePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid Ghana phone number (+233)" });
    return;
  }

  const passwordError = validatePasswordStrength(parsed.data.password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  if (requiresPayoutMomo(parsed.data.role)) {
    const momo = normalizeMomoNumber(parsed.data.payoutMomoNumber ?? "");
    if (!momo) {
      res.status(400).json({
        error: "A valid payout mobile money number is required for suppliers",
      });
      return;
    }
    parsed.data.payoutMomoNumber = momo;
  }

  const verified = await hasVerifiedRegistrationOtp(phone);
  if (!verified) {
    res.status(400).json({ error: "Phone number has not been verified" });
    return;
  }

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone));

  if (existingUser) {
    res.status(400).json({ error: "An account already exists for this phone number" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const [user] = await db
    .insert(usersTable)
    .values({
      phone,
      passwordHash,
      businessName: parsed.data.businessName,
      location: parsed.data.location,
      role: parsed.data.role,
      category: parsed.data.category,
      payoutMomoNumber: parsed.data.payoutMomoNumber,
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create account" });
    return;
  }

  req.session.userId = user.id;
  res.status(201).json(RegisterResponse.parse(userWithoutSecrets(user)));
});

router.get("/auth/me", requireAuth, (req, res): void => {
  res.json(GetCurrentUserResponse.parse(userWithoutSecrets(req.currentUser!)));
});

router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const nextRole = parsed.data.role ?? req.currentUser!.role;
  const nextPayout =
    parsed.data.payoutMomoNumber ?? req.currentUser!.payoutMomoNumber;

  if (requiresPayoutMomo(nextRole)) {
    const momo = normalizeMomoNumber(nextPayout ?? "");
    if (!momo) {
      res.status(400).json({
        error: "A valid payout mobile money number is required for suppliers",
      });
      return;
    }
    parsed.data.payoutMomoNumber = momo;
  }

  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, req.currentUser!.id))
    .returning();

  res.json(UpdateCurrentUserResponse.parse(userWithoutSecrets(user!)));
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

export default router;
