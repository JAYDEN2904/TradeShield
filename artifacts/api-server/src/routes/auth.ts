import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, otpCodesTable } from "@workspace/db";
import {
  RequestOtpBody,
  RequestOtpResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
  RegisterBody,
  RegisterResponse,
  GetCurrentUserResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const OTP_TTL_MS = 5 * 60 * 1000;

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/auth/request-otp", async (req, res): Promise<void> => {
  const parsed = RequestOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const code = generateOtpCode();
  await db.insert(otpCodesTable).values({
    phone: parsed.data.phone,
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  req.log.info({ phone: parsed.data.phone }, "OTP requested (mock)");

  res.json(
    RequestOtpResponse.parse({
      message: "OTP sent (mocked for MVP demo)",
      debugCode: code,
    }),
  );
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { phone, code } = parsed.data;

  const [otp] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.phone, phone),
        eq(otpCodesTable.code, code),
        eq(otpCodesTable.used, false),
      ),
    )
    .orderBy(otpCodesTable.createdAt)
    .limit(1);

  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.id, otp.id));

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone));

  if (existingUser) {
    req.session.userId = existingUser.id;
    res.json(
      VerifyOtpResponse.parse({
        verified: true,
        needsRegistration: false,
        user: existingUser,
      }),
    );
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

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { phone } = parsed.data;

  const wasVerified = await db
    .select()
    .from(otpCodesTable)
    .where(and(eq(otpCodesTable.phone, phone), eq(otpCodesTable.used, true)))
    .limit(1);

  if (wasVerified.length === 0) {
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

  const [user] = await db
    .insert(usersTable)
    .values({
      phone,
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
  res.status(201).json(RegisterResponse.parse(user));
});

router.get("/auth/me", requireAuth, (req, res): void => {
  res.json(GetCurrentUserResponse.parse(req.currentUser));
});

router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, req.currentUser!.id))
    .returning();

  res.json(UpdateCurrentUserResponse.parse(user));
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

export default router;
