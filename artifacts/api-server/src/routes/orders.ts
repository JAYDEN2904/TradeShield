import { Router, type IRouter } from "express";
import { eq, and, or } from "drizzle-orm";
import {
  db,
  ordersTable,
  productsTable,
  usersTable,
  disputesTable,
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
  PayOrderParams,
  ShipOrderParams,
  ConfirmReceiptParams,
  RaiseDisputeParams,
  RaiseDisputeBody,
  CreateRatingParams,
  CreateRatingBody,
  CreateRatingResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { applyTransition, InvalidOrderTransitionError } from "../lib/orderStateMachine";
import { paymentProvider } from "../lib/paymentProvider";

const router: IRouter = Router();

const SHIP_WINDOW_MS = 72 * 60 * 60 * 1000;
const PLATFORM_FEE_RATE = 0.02;

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
  const [dispute] = await db
    .select()
    .from(disputesTable)
    .where(eq(disputesTable.orderId, order.id))
    .orderBy(disputesTable.createdAt);

  return {
    ...order,
    product,
    buyer,
    supplier,
    dispute: dispute ?? null,
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
    .select()
    .from(ordersTable)
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
  const totalAmount = (unitPrice * parsed.data.quantity).toFixed(2);
  const platformFee = (unitPrice * parsed.data.quantity * PLATFORM_FEE_RATE).toFixed(2);

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
    })
    .returning();

  if (!order) {
    res.status(500).json({ error: "Failed to create order" });
    return;
  }

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
  res.json(result.order);
});

router.post("/orders/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const params = RejectOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await transitionOrder(
    params.data.id,
    "expired",
    "supplier",
    (order) =>
      order.supplierId === req.currentUser!.id ? null : "Only the supplier can reject this order",
  );
  if (result.error) {
    res.status(result.status ?? 400).json({ error: result.error });
    return;
  }
  res.json(result.order);
});

router.post("/orders/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const params = PayOrderParams.safeParse(req.params);
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
    res.status(403).json({ error: "Only the buyer can pay for this order" });
    return;
  }

  try {
    const nextStatus = applyTransition(order.status, "payment_processing", "buyer");
    const [updated] = await db
      .update(ordersTable)
      .set({ status: nextStatus })
      .where(eq(ordersTable.id, order.id))
      .returning();

    const charge = await paymentProvider.charge({
      orderId: order.id,
      amount: order.totalAmount,
      payerPhone: req.currentUser!.phone,
    });

    await db.insert(transactionsTable).values({
      orderId: order.id,
      type: "collection",
      moolreReference: charge.reference,
      status: charge.status,
      amount: order.totalAmount,
    });

    res.json(updated);
  } catch (err) {
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
      applyTransition(order.status, "completed", "buyer");

      const payoutAmount = (
        Number(order.totalAmount) - Number(order.platformFee)
      ).toFixed(2);

      const disburse = await paymentProvider.disburse({
        orderId: order.id,
        amount: payoutAmount,
        payoutMomoNumber: supplier?.payoutMomoNumber ?? "",
      });

      await db.insert(transactionsTable).values({
        orderId: order.id,
        type: "disbursement",
        moolreReference: disburse.reference,
        status: disburse.status,
        amount: payoutAmount,
      });

      const finalStatus = disburse.status === "failed" ? "payout_failed" : "completed";
      const [updated] = await db
        .update(ordersTable)
        .set({ status: finalStatus })
        .where(eq(ordersTable.id, order.id))
        .returning();

      res.json(updated);
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

    try {
      const nextStatus = applyTransition(order.status, "disputed", actor);
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
        })
        .returning();

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
