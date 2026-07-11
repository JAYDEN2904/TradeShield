import { Router, type IRouter } from "express";
import { eq, inArray, desc, and, type SQL } from "drizzle-orm";
import { db, usersTable, kycDocumentsTable } from "@workspace/db";
import {
  SubmitKycBody,
  RejectKycBody,
  GetKycStatusResponse,
  SubmitKycResponse,
  GetAdminKycQueueResponse,
  GetAdminKycUsersQueryParams,
  GetAdminKycUsersResponse,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// Ghana Card format: GHA-XXXXXXXXX-X (GHA- prefix, 9 digits, dash, 1 digit)
const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;

async function loadDocumentsByUserIds(userIds: number[]) {
  if (userIds.length === 0) {
    return new Map<number, { docType: string; storageUrl: string }[]>();
  }

  const documents = await db
    .select({
      userId: kycDocumentsTable.userId,
      docType: kycDocumentsTable.docType,
      storageUrl: kycDocumentsTable.storageUrl,
    })
    .from(kycDocumentsTable)
    .where(inArray(kycDocumentsTable.userId, userIds));

  const docsByUser = new Map<number, { docType: string; storageUrl: string }[]>();
  for (const doc of documents) {
    const list = docsByUser.get(doc.userId) ?? [];
    list.push({ docType: doc.docType, storageUrl: doc.storageUrl });
    docsByUser.set(doc.userId, list);
  }

  return docsByUser;
}

// ---------------------------------------------------------------------------
// GET /kyc/status
// ---------------------------------------------------------------------------

router.get("/kyc/status", requireAuth, (req, res): void => {
  const user = req.currentUser!;
  res.json(
    GetKycStatusResponse.parse({
      kycStatus: user.kycStatus,
      kycRejectionReason: user.kycRejectionReason ?? null,
      ghanaCardNumber: user.ghanaCardNumber ?? null,
    }),
  );
});

// ---------------------------------------------------------------------------
// POST /kyc/submit
// ---------------------------------------------------------------------------

router.post("/kyc/submit", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubmitKycBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = req.currentUser!;

  if (user.kycStatus === "pending") {
    res.status(400).json({
      error: "Your documents are already under review. We'll notify you once complete.",
    });
    return;
  }

  if (user.kycStatus === "approved") {
    res.status(400).json({ error: "Your account is already verified." });
    return;
  }

  if (!GHANA_CARD_REGEX.test(parsed.data.ghanaCardNumber)) {
    res.status(400).json({
      error: "Ghana Card number must be in the format GHA-XXXXXXXXX-X",
    });
    return;
  }

  const { ghanaCardNumber, docUrls } = parsed.data;

  try {
    await db
      .update(usersTable)
      .set({
        ghanaCardNumber,
        kycStatus: "pending",
        kycSubmittedAt: new Date(),
        kycRejectionReason: null,
        kycReviewedAt: null,
      })
      .where(eq(usersTable.id, user.id));

    await db
      .delete(kycDocumentsTable)
      .where(eq(kycDocumentsTable.userId, user.id));

    await db.insert(kycDocumentsTable).values([
      {
        userId: user.id,
        docType: "ghana_card_front",
        storageUrl: docUrls.ghana_card_front,
        status: "pending",
      },
      {
        userId: user.id,
        docType: "ghana_card_back",
        storageUrl: docUrls.ghana_card_back,
        status: "pending",
      },
    ]);

    res.json(SubmitKycResponse.parse({ submitted: true }));
  } catch (err) {
    req.log.error({ err }, "KYC submit failed");
    res.status(500).json({ error: "Could not submit verification. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/kyc/queue
// ---------------------------------------------------------------------------

router.get("/admin/kyc/queue", requireAdmin, async (req, res): Promise<void> => {
  const pendingUsers = await db
    .select({
      id: usersTable.id,
      phone: usersTable.phone,
      businessName: usersTable.businessName,
      role: usersTable.role,
      kycSubmittedAt: usersTable.kycSubmittedAt,
      ghanaCardNumber: usersTable.ghanaCardNumber,
    })
    .from(usersTable)
    .where(eq(usersTable.kycStatus, "pending"));

  if (pendingUsers.length === 0) {
    res.json(GetAdminKycQueueResponse.parse([]));
    return;
  }

  const userIds = pendingUsers.map((u) => u.id);
  const docsByUser = await loadDocumentsByUserIds(userIds);

  const queue = pendingUsers
    .filter((u) => u.kycSubmittedAt !== null)
    .map((u) => ({
      id: u.id,
      phone: u.phone,
      businessName: u.businessName,
      role: u.role,
      kycSubmittedAt: u.kycSubmittedAt!,
      ghanaCardNumber: u.ghanaCardNumber ?? null,
      documents: docsByUser.get(u.id) ?? [],
    }));

  res.json(GetAdminKycQueueResponse.parse(queue));
});

// ---------------------------------------------------------------------------
// GET /admin/kyc/users
// ---------------------------------------------------------------------------

router.get("/admin/kyc/users", requireAdmin, async (req, res): Promise<void> => {
  const query = GetAdminKycUsersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions: SQL[] = [];
  if (query.data.status) {
    conditions.push(eq(usersTable.kycStatus, query.data.status));
  }

  const allUsers = await db
    .select({
      id: usersTable.id,
      phone: usersTable.phone,
      businessName: usersTable.businessName,
      role: usersTable.role,
      kycStatus: usersTable.kycStatus,
      kycSubmittedAt: usersTable.kycSubmittedAt,
      kycReviewedAt: usersTable.kycReviewedAt,
      ghanaCardNumber: usersTable.ghanaCardNumber,
      kycRejectionReason: usersTable.kycRejectionReason,
    })
    .from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(usersTable.kycSubmittedAt), desc(usersTable.createdAt));

  const docsByUser = await loadDocumentsByUserIds(allUsers.map((u) => u.id));

  const records = allUsers.map((u) => ({
    id: u.id,
    phone: u.phone,
    businessName: u.businessName,
    role: u.role,
    kycStatus: u.kycStatus,
    kycSubmittedAt: u.kycSubmittedAt ?? null,
    kycReviewedAt: u.kycReviewedAt ?? null,
    ghanaCardNumber: u.ghanaCardNumber ?? null,
    kycRejectionReason: u.kycRejectionReason ?? null,
    documents: docsByUser.get(u.id) ?? [],
  }));

  res.json(GetAdminKycUsersResponse.parse(records));
});

// ---------------------------------------------------------------------------
// PATCH /admin/kyc/:userId/approve
// ---------------------------------------------------------------------------

router.patch(
  "/admin/kyc/:userId/approve",
  requireAdmin,
  async (req, res): Promise<void> => {
    const userId = parseInt(String(req.params.userId), 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        kycStatus: "approved",
        kycReviewedAt: new Date(),
        kycRejectionReason: null,
      })
      .where(eq(usersTable.id, userId))
      .returning();

    await db
      .update(kycDocumentsTable)
      .set({ status: "accepted" })
      .where(eq(kycDocumentsTable.userId, userId));

    res.json(
      GetKycStatusResponse.parse({
        kycStatus: updated!.kycStatus,
        kycRejectionReason: updated!.kycRejectionReason ?? null,
        ghanaCardNumber: updated!.ghanaCardNumber ?? null,
      }),
    );
  },
);

// ---------------------------------------------------------------------------
// PATCH /admin/kyc/:userId/reject
// ---------------------------------------------------------------------------

router.patch(
  "/admin/kyc/:userId/reject",
  requireAdmin,
  async (req, res): Promise<void> => {
    const userId = parseInt(String(req.params.userId), 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const parsed = RejectKycBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        kycStatus: "rejected",
        kycReviewedAt: new Date(),
        kycRejectionReason: parsed.data.reason,
      })
      .where(eq(usersTable.id, userId))
      .returning();

    await db
      .update(kycDocumentsTable)
      .set({ status: "rejected" })
      .where(eq(kycDocumentsTable.userId, userId));

    res.json(
      GetKycStatusResponse.parse({
        kycStatus: updated!.kycStatus,
        kycRejectionReason: updated!.kycRejectionReason ?? null,
        ghanaCardNumber: updated!.ghanaCardNumber ?? null,
      }),
    );
  },
);

export default router;
