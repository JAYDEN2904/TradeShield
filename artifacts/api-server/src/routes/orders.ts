import { Router, type IRouter } from "express";
import { eq, and, or } from "drizzle-orm";
import {
  db,
  ordersTable,
  productsTable,
  usersTable,
  disputesTable,
  disputeRepliesTable,
  ratingsTable,
  transactionsTable,
  type Order,
} from "@workspace/db";
import {
  ListOrdersQueryParams,
  ListOrdersResponse,
  CreateOrderBody,
  CreateOrderResponse,
  GetOrderParams,
  GetOrderResponse,
  AcceptOrderParams,
  RejectOrderParams,
  RejectOrderBody,
  PayOrderParams,
  ShipOrderParams,
  ConfirmReceiptParams,
  ConfirmReceiptBody,
  RaiseDisputeParams,
  RaiseDisputeBody,
  RequestRefundParams,
  ReplyToDisputeParams,
  ReplyToDisputeBody,
  CreateRatingParams,
  CreateRatingBody,
  CreateRatingResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { applyTransition, InvalidOrderTransitionError } from "../lib/orderStateMachine";
import {
  initiateOrderCollection,
  initiateOrderPayout,
  PaymentInProgressError,
  PaymentOtpRequiredError,
  PaymentProviderRejectedError,
} from "../lib/paymentOrchestration";
import { isMomoProvider, momoProviderMismatchMessage } from "../lib/moolreClient";
import { normalizeMomoNumber } from "../lib/phoneValidation";
import {
  fireAndForget,
  notifyDisputeOpened,
  notifyOrderAccepted,
  notifyOrderCreated,
  notifyOrderRejected,
  notifyOrderShipped,
} from "../lib/orderNotifications";

const router: IRouter = Router();

const SHIP_WINDOW_MS = 72 * 60 * 60 * 1000;
const PENDING_EXPIRY_MS = 24 * 60 * 60 * 1000;
const PLATFORM_FEE_RATE = 0.02;
const REFUND_REQUEST_DELAY_MS = 5 * 24 * 60 * 60 * 1000;
const POST_RELEASE_DISPUTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

async function loadOrderDetail(order: Order) {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, order.productId));
  const [buyer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, order.buyerId));
  const [supplier] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, order.supplierId));
  const disputes = await db
    .select()
    .from(disputesTable)
    .where(eq(disputesTable.orderId, order.id))
    .orderBy(disputesTable.createdAt);

  return {
    ...order,
    product,
    buyer,
    supplier,
    disputes,
  };
}

function isParty(order: Order, userId: number): boolean {
  return order.buyerId === userId || order.supplierId === userId;
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const userId = req.currentUser!.id;
  const conditions = [];

  if (query.data.role === "buyer") {
    conditions.push(eq(ordersTable.buyerId, userId));
  } else if (query.data.role === "supplier") {
    conditions.push(eq(ordersTable.supplierId, userId));
  } else {
    conditions.push(
      or(eq(ordersTable.buyerId, userId), eq(ordersTable.supplierId, userId))!,
    );
  }

  if (query.data.status) {
    conditions.push(eq(ordersTable.status, query.data.status));
  }

  const orders = await db
    .select({
      id: ordersTable.id,
      buyerId: ordersTable.buyerId,
      supplierId: ordersTable.supplierId,
      productId: ordersTable.productId,
      quantity: ordersTable.quantity,
      totalAmount: ordersTable.totalAmount,
      platformFee: ordersTable.platformFee,
      status: ordersTable.status,
      createdAt: ordersTable.createdAt,
      shippedAt: ordersTable.shippedAt,
      autoReleaseAt: ordersTable.autoReleaseAt,
      deliveryLocation: ordersTable.deliveryLocation,
      preferredDeliveryDate: ordersTable.preferredDeliveryDate,
      rejectReason: ordersTable.rejectReason,
      expiresAt: ordersTable.expiresAt,
      autoReleaseReminderSent: ordersTable.autoReleaseReminderSent,
      confirmPhotoUrl: ordersTable.confirmPhotoUrl,
      productName: productsTable.name,
    })
    .from(ordersTable)
    .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(and(...conditions))
    .orderBy(ordersTable.createdAt);

  res.json(ListOrdersResponse.parse(orders));
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (req.currentUser!.isAdmin) {
    res.status(403).json({
      error: "Admin accounts cannot place orders. Use a non-admin buyer account.",
    });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, parsed.data.productId));

  if (!product || !product.isActive) {
    res.status(400).json({ error: "Product not available" });
    return;
  }

  if (parsed.data.quantity < product.moq) {
    res
      .status(400)
      .json({ error: `Minimum order quantity is ${product.moq}` });
    return;
  }

  if (parsed.data.quantity > product.stockQty) {
    res.status(400).json({ error: "Insufficient stock" });
    return;
  }

  if (product.supplierId === req.currentUser!.id) {
    res.status(400).json({ error: "Cannot order your own product" });
    return;
  }

  const unitPrice = Number(product.unitPrice);
  const orderTotal = unitPrice * parsed.data.quantity;
  const totalAmount = orderTotal.toFixed(2);
  const platformFee = (orderTotal * PLATFORM_FEE_RATE).toFixed(2);

  // Orders above GHS 10,000 require both buyer and supplier to be verified
  const HIGH_VALUE_THRESHOLD = 10000;
  if (orderTotal > HIGH_VALUE_THRESHOLD) {
    const buyer = req.currentUser!;
    if (buyer.kycStatus !== "approved") {
      res.status(403).json({
        error:
          "Orders above GHS 10,000 require both buyer and supplier to be verified. Complete verification in your account settings.",
      });
      return;
    }

    const [supplier] = await db
      .select({ kycStatus: usersTable.kycStatus })
      .from(usersTable)
      .where(eq(usersTable.id, product.supplierId));

    if (!supplier || supplier.kycStatus !== "approved") {
      res.status(403).json({
        error:
          "Orders above GHS 10,000 require both buyer and supplier to be verified. This supplier has not yet completed verification.",
      });
      return;
    }
  }
  const preferredDeliveryDate = new Date(parsed.data.preferredDeliveryDate);

  if (Number.isNaN(preferredDeliveryDate.getTime())) {
    res.status(400).json({ error: "Invalid preferred delivery date" });
    return;
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      buyerId: req.currentUser!.id,
      supplierId: product.supplierId,
      productId: product.id,
      quantity: parsed.data.quantity,
      totalAmount,
      platformFee,
      status: "pending_supplier_confirmation",
      deliveryLocation: parsed.data.deliveryLocation,
      preferredDeliveryDate,
      expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
    })
    .returning();

  if (!order) {
    res.status(500).json({ error: "Failed to create order" });
    return;
  }

  fireAndForget(notifyOrderCreated(order), "order_created");

  res.status(201).json(CreateOrderResponse.parse(order));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (!isParty(order, req.currentUser!.id) && !req.currentUser!.isAdmin) {
    res.status(403).json({ error: "Not a party to this order" });
    return;
  }

  res.json(GetOrderResponse.parse(await loadOrderDetail(order)));
});

async function transitionOrder(
  orderId: number,
  targetStatus: Order["status"],
  actor: "buyer" | "supplier" | "system",
  guard: (order: Order) => string | null,
): Promise<{ order?: Order; error?: string; status?: number }> {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    return { error: "Order not found", status: 404 };
  }

  const guardError = guard(order);
  if (guardError) {
    return { error: guardError, status: 403 };
  }

  try {
    const nextStatus = applyTransition(order.status, targetStatus, actor);
    const [updated] = await db
      .update(ordersTable)
      .set({ status: nextStatus })
      .where(eq(ordersTable.id, orderId))
      .returning();
    return { order: updated };
  } catch (err) {
    if (err instanceof InvalidOrderTransitionError) {
      return { error: err.message, status: 409 };
    }
    throw err;
  }
}

router.post("/orders/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const params = AcceptOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await transitionOrder(
    params.data.id,
    "awaiting_payment",
    "supplier",
    (order) =>
      order.supplierId === req.currentUser!.id ? null : "Only the supplier can accept this order",
  );
  if (result.error) {
    res.status(result.status ?? 400).json({ error: result.error });
    return;
  }
  if (result.order) {
    fireAndForget(notifyOrderAccepted(result.order), "order_accepted");
  }
  res.json(result.order);
});

router.post("/orders/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const params = RejectOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsedBody = RejectOrderBody.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.supplierId !== req.currentUser!.id) {
    res.status(403).json({ error: "Only the supplier can reject this order" });
    return;
  }

  try {
    const nextStatus = applyTransition(order.status, "rejected", "supplier");
    const [updated] = await db
      .update(ordersTable)
      .set({
        status: nextStatus,
        rejectReason: parsedBody.data.reason ?? null,
      })
      .where(eq(ordersTable.id, order.id))
      .returning();

    if (updated) {
      fireAndForget(
        notifyOrderRejected(updated, parsedBody.data.reason),
        "order_rejected",
      );
    }

    res.json(updated);
  } catch (err) {
    if (err instanceof InvalidOrderTransitionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/orders/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const params = PayOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const otpCode =
    typeof req.body?.otpCode === "string" ? req.body.otpCode.trim() : undefined;

  const rawProvider =
    typeof req.body?.momoProvider === "string"
      ? req.body.momoProvider.trim().toLowerCase()
      : undefined;
  const momoProvider = rawProvider && isMomoProvider(rawProvider) ? rawProvider : undefined;

  const rawMomoNumber =
    typeof req.body?.momoNumber === "string" ? req.body.momoNumber.trim() : undefined;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.buyerId !== req.currentUser!.id) {
    res.status(403).json({ error: "Only the buyer can pay for this order" });
    return;
  }

  let payerPhone: string | null = null;
  if (rawMomoNumber) {
    payerPhone = normalizeMomoNumber(rawMomoNumber);
    if (!payerPhone) {
      res.status(400).json({ error: "Enter a valid Ghana mobile money number." });
      return;
    }
  } else {
    // Prefer the MoMo number stored from the buyer's payment dialog — never the
    // account registration phone — so OTP / USSD go to the wallet they entered.
    payerPhone = order.paymentMomoNumber
      ? normalizeMomoNumber(order.paymentMomoNumber)
      : null;
  }

  if (!otpCode) {
    if (!momoProvider && !(order.paymentMomoProvider && isMomoProvider(order.paymentMomoProvider))) {
      res.status(400).json({
        error: "Select a mobile money provider (MTN, Telecel, or AirtelTigo).",
      });
      return;
    }
    if (!payerPhone) {
      res.status(400).json({ error: "Enter a valid Ghana mobile money number." });
      return;
    }
  } else if (!payerPhone) {
    res.status(400).json({
      error: "Payment number missing. Start payment again and enter your MoMo number.",
    });
    return;
  }

  const resolvedProvider =
    momoProvider ||
    (order.paymentMomoProvider && isMomoProvider(order.paymentMomoProvider)
      ? order.paymentMomoProvider
      : undefined);

  if (resolvedProvider && payerPhone) {
    const mismatch = momoProviderMismatchMessage(payerPhone, resolvedProvider);
    if (mismatch) {
      res.status(400).json({ error: mismatch });
      return;
    }
  }

  try {
    const updated = await initiateOrderCollection(
      order,
      payerPhone,
      "buyer",
      {
        otpCode: otpCode || undefined,
        momoProvider: resolvedProvider,
      },
    );
    res.json(updated);
  } catch (err) {
    if (err instanceof PaymentInProgressError) {
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof PaymentOtpRequiredError) {
      res.status(428).json({ error: err.message, code: "OTP_REQUIRED" });
      return;
    }
    if (err instanceof PaymentProviderRejectedError) {
      res.status(502).json({ error: err.message });
      return;
    }
    if (err instanceof InvalidOrderTransitionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/orders/:id/ship", requireAuth, async (req, res): Promise<void> => {
  const params = ShipOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.supplierId !== req.currentUser!.id) {
    res.status(403).json({ error: "Only the supplier can ship this order" });
    return;
  }

  try {
    const nextStatus = applyTransition(order.status, "shipped", "supplier");
    const now = new Date();
    const [updated] = await db
      .update(ordersTable)
      .set({
        status: nextStatus,
        shippedAt: now,
        autoReleaseAt: new Date(now.getTime() + SHIP_WINDOW_MS),
      })
      .where(eq(ordersTable.id, order.id))
      .returning();
    if (updated) {
      fireAndForget(notifyOrderShipped(updated), "order_shipped");
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof InvalidOrderTransitionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post(
  "/orders/:id/confirm-receipt",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ConfirmReceiptParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsedBody = ConfirmReceiptBody.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.message });
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, params.data.id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.buyerId !== req.currentUser!.id) {
      res.status(403).json({ error: "Only the buyer can confirm receipt" });
      return;
    }

    const [supplier] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, order.supplierId));

    try {
      if (parsedBody.data.photoUrl) {
        await db
          .update(ordersTable)
          .set({ confirmPhotoUrl: parsedBody.data.photoUrl })
          .where(eq(ordersTable.id, order.id));
      }

      const [orderForPayout] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, order.id));

      const updated = await initiateOrderPayout(
        orderForPayout ?? order,
        supplier?.payoutMomoNumber ?? "",
        "buyer",
      );
      res.json(updated);
    } catch (err) {
      if (err instanceof PaymentInProgressError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof PaymentProviderRejectedError) {
        res.status(502).json({ error: err.message });
        return;
      }
      if (err instanceof InvalidOrderTransitionError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes("payout mobile money")) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

router.post(
  "/orders/:id/dispute",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = RaiseDisputeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = RaiseDisputeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, params.data.id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (!isParty(order, req.currentUser!.id)) {
      res.status(403).json({ error: "Not a party to this order" });
      return;
    }

    const actor = order.buyerId === req.currentUser!.id ? "buyer" : "supplier";

    let targetStatus: Order["status"] = "disputed";
    if (order.status === "completed") {
      if (actor !== "buyer") {
        res.status(403).json({ error: "Only the buyer can dispute a completed order" });
        return;
      }
      if (!order.autoReleaseAt) {
        res.status(409).json({ error: "Order has no auto-release timestamp" });
        return;
      }
      const windowEnd =
        order.autoReleaseAt.getTime() + POST_RELEASE_DISPUTE_WINDOW_MS;
      if (Date.now() > windowEnd) {
        res.status(409).json({
          error: "Post-release dispute window has expired (7 days after auto-release)",
        });
        return;
      }
      targetStatus = "post_release_disputed";
    }

    try {
      const nextStatus = applyTransition(order.status, targetStatus, actor);
      await db
        .update(ordersTable)
        .set({ status: nextStatus })
        .where(eq(ordersTable.id, order.id));

      const [dispute] = await db
        .insert(disputesTable)
        .values({
          orderId: order.id,
          raisedBy: req.currentUser!.id,
          reason: parsed.data.reason,
          category: parsed.data.category ?? null,
          evidenceUrls: parsed.data.evidenceUrls ?? null,
        })
        .returning();

      const [updatedOrder] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, order.id));
      if (updatedOrder) {
        fireAndForget(notifyDisputeOpened(updatedOrder), "dispute_opened");
      }

      res.status(201).json(dispute);
    } catch (err) {
      if (err instanceof InvalidOrderTransitionError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

router.post(
  "/orders/:id/request-refund",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = RequestRefundParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, params.data.id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.buyerId !== req.currentUser!.id) {
      res.status(403).json({ error: "Only the buyer can request a refund" });
      return;
    }

    if (order.status !== "in_escrow") {
      res.status(409).json({ error: "Refund requests are only allowed while funds are in escrow" });
      return;
    }

    if (order.shippedAt) {
      res.status(409).json({ error: "Order has already been shipped" });
      return;
    }

    const [collection] = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.orderId, order.id),
          eq(transactionsTable.type, "collection"),
          eq(transactionsTable.status, "succeeded"),
        ),
      )
      .orderBy(transactionsTable.createdAt);

    if (!collection) {
      res.status(409).json({ error: "No successful payment found for this order" });
      return;
    }

    const eligibleAt = collection.createdAt.getTime() + REFUND_REQUEST_DELAY_MS;
    if (Date.now() < eligibleAt) {
      res.status(409).json({
        error: "Refund request available 5 days after payment with no shipment update",
      });
      return;
    }

    try {
      const nextStatus = applyTransition(order.status, "disputed", "buyer");
      await db
        .update(ordersTable)
        .set({ status: nextStatus })
        .where(eq(ordersTable.id, order.id));

      const [dispute] = await db
        .insert(disputesTable)
        .values({
          orderId: order.id,
          raisedBy: req.currentUser!.id,
          reason: "Buyer refund request: no shipment update after 5 days",
          category: "non_delivery",
        })
        .returning();

      const [updatedOrder] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, order.id));
      if (updatedOrder) {
        fireAndForget(notifyDisputeOpened(updatedOrder), "dispute_opened");
      }

      res.status(201).json(dispute);
    } catch (err) {
      if (err instanceof InvalidOrderTransitionError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

router.post(
  "/orders/:id/dispute-reply",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ReplyToDisputeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = ReplyToDisputeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, params.data.id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.supplierId !== req.currentUser!.id) {
      res.status(403).json({ error: "Only the supplier can reply to a dispute" });
      return;
    }

    if (order.status !== "disputed" && order.status !== "post_release_disputed") {
      res.status(409).json({ error: "Order is not under dispute" });
      return;
    }

    const [openDispute] = await db
      .select()
      .from(disputesTable)
      .where(
        and(
          eq(disputesTable.orderId, order.id),
          eq(disputesTable.status, "open"),
        ),
      )
      .orderBy(disputesTable.createdAt);

    if (!openDispute) {
      res.status(409).json({ error: "No open dispute found for this order" });
      return;
    }

    const [reply] = await db
      .insert(disputeRepliesTable)
      .values({
        disputeId: openDispute.id,
        authorId: req.currentUser!.id,
        message: parsed.data.message,
      })
      .returning();

    res.status(201).json(reply);
  },
);

router.post(
  "/orders/:id/ratings",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = CreateRatingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreateRatingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, params.data.id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (!isParty(order, req.currentUser!.id)) {
      res.status(403).json({ error: "Not a party to this order" });
      return;
    }

    if (order.status !== "completed") {
      res.status(409).json({ error: "Order is not completed yet" });
      return;
    }

    const rateeId =
      order.buyerId === req.currentUser!.id ? order.supplierId : order.buyerId;

    const [existing] = await db
      .select()
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.orderId, order.id),
          eq(ratingsTable.raterId, req.currentUser!.id),
        ),
      );

    if (existing) {
      res.status(409).json({ error: "You already rated this order" });
      return;
    }

    const [rating] = await db
      .insert(ratingsTable)
      .values({
        orderId: order.id,
        raterId: req.currentUser!.id,
        rateeId,
        stars: parsed.data.stars,
        comment: parsed.data.comment,
      })
      .returning();

    res.status(201).json(CreateRatingResponse.parse(rating));
  },
);

export default router;
