import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  productsTable,
  usersTable,
  disputesTable,
  type Order,
} from "@workspace/db";
import {
  ListAllOrdersQueryParams,
  ListAllOrdersResponse,
  ListDisputesQueryParams,
  ListDisputesResponse,
  ResolveDisputeBody,
  GetAdminMetricsResponse,
  AdminReleaseOrderFundsParams,
  AdminRefundOrderParams,
  AdminRetryPayoutParams,
  AdminExpireOrderParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";
import { applyTransition, InvalidOrderTransitionError } from "../lib/orderStateMachine";
import {
  initiateOrderPayout,
  initiateOrderRefund,
  PaymentInProgressError,
} from "../lib/paymentOrchestration";
import { logAdminAction } from "../lib/adminActions";
import { fireAndForget, notifyDisputeResolved } from "../lib/orderNotifications";

const router: IRouter = Router();

function parseAdminNotes(body: unknown): string | undefined {
  if (body && typeof body === "object" && "notes" in body) {
    const notes = (body as { notes?: unknown }).notes;
    if (typeof notes === "string" && notes.trim()) return notes.trim();
  }
  return undefined;
}

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

  return { ...order, product, buyer, supplier, disputes };
}

router.get("/admin/metrics", requireAdmin, async (_req, res): Promise<void> => {
  const [volumeRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${ordersTable.totalAmount}), 0)`,
      fees: sql<string>`coalesce(sum(${ordersTable.platformFee}), 0)`,
      totalOrders: sql<number>`count(*)::int`,
      completedOrders: sql<number>`count(*) filter (where ${ordersTable.status} = 'completed')::int`,
    })
    .from(ordersTable);

  const activeUsers = await db
    .select({
      role: usersTable.role,
      count: sql<number>`count(*)::int`,
    })
    .from(usersTable)
    .where(eq(usersTable.isAdmin, false))
    .groupBy(usersTable.role);

  const [openDisputesRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(disputesTable)
    .where(eq(disputesTable.status, "open"));

  const buyerCount =
    activeUsers.find((r) => r.role === "buyer")?.count ?? 0;
  const supplierCount =
    activeUsers.find((r) => r.role === "supplier")?.count ?? 0;
  const bothCount = activeUsers.find((r) => r.role === "both")?.count ?? 0;

  const totalOrders = volumeRow?.totalOrders ?? 0;
  const completedOrders = volumeRow?.completedOrders ?? 0;
  const completionRate =
    totalOrders > 0 ? completedOrders / totalOrders : 0;

  res.json(
    GetAdminMetricsResponse.parse({
      totalVolumeGhs: volumeRow?.total ?? "0",
      totalPlatformFeesGhs: volumeRow?.fees ?? "0",
      activeBuyers: buyerCount + bothCount,
      activeSuppliers: supplierCount + bothCount,
      totalOrders,
      completedOrders,
      completionRate,
      openDisputes: openDisputesRow?.count ?? 0,
    }),
  );
});

router.get("/admin/orders", requireAdmin, async (req, res): Promise<void> => {
  const query = ListAllOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const orders = query.data.status
    ? await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.status, query.data.status))
        .orderBy(ordersTable.createdAt)
    : await db.select().from(ordersTable).orderBy(ordersTable.createdAt);

  const detailed = await Promise.all(orders.map(loadOrderDetail));
  res.json(ListAllOrdersResponse.parse(detailed));
});

router.get("/admin/disputes", requireAdmin, async (req, res): Promise<void> => {
  const query = ListDisputesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const disputes = query.data.status
    ? await db
        .select()
        .from(disputesTable)
        .where(eq(disputesTable.status, query.data.status))
        .orderBy(disputesTable.createdAt)
    : await db.select().from(disputesTable).orderBy(disputesTable.createdAt);

  res.json(ListDisputesResponse.parse(disputes));
});

async function loadOrderForAdmin(orderId: number): Promise<Order | null> {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));
  return order ?? null;
}

router.post(
  "/admin/orders/:id/release",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AdminReleaseOrderFundsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const order = await loadOrderForAdmin(params.data.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const releasable = ["in_escrow", "shipped", "payout_failed"] as const;
    if (!releasable.includes(order.status as (typeof releasable)[number])) {
      res.status(409).json({ error: `Cannot release funds from status ${order.status}` });
      return;
    }

    const [supplier] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, order.supplierId));

    try {
      const updated = await initiateOrderPayout(
        order,
        supplier?.payoutMomoNumber ?? "",
        "admin",
      );

      await logAdminAction({
        adminId: req.currentUser!.id,
        orderId: order.id,
        action: "release_funds",
        details: parseAdminNotes(req.body) ?? "Manual fund release",
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof PaymentInProgressError || err instanceof InvalidOrderTransitionError) {
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
  "/admin/orders/:id/refund",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AdminRefundOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const order = await loadOrderForAdmin(params.data.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const refundable = ["awaiting_payment", "in_escrow", "shipped", "disputed"] as const;
    if (!refundable.includes(order.status as (typeof refundable)[number])) {
      res.status(409).json({ error: `Cannot refund order in status ${order.status}` });
      return;
    }

    try {
      const updated = await initiateOrderRefund(order, "admin");

      await logAdminAction({
        adminId: req.currentUser!.id,
        orderId: order.id,
        action: "refund",
        details: parseAdminNotes(req.body) ?? "Manual buyer refund",
      });

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
  "/admin/orders/:id/retry-payout",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AdminRetryPayoutParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const order = await loadOrderForAdmin(params.data.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.status !== "payout_failed") {
      res.status(409).json({ error: "Order is not in payout_failed status" });
      return;
    }

    const [supplier] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, order.supplierId));

    try {
      const updated = await initiateOrderPayout(
        order,
        supplier?.payoutMomoNumber ?? "",
        "admin",
      );

      await logAdminAction({
        adminId: req.currentUser!.id,
        orderId: order.id,
        action: "retry_payout",
        details: parseAdminNotes(req.body) ?? "Retry failed disbursement",
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof PaymentInProgressError || err instanceof InvalidOrderTransitionError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

router.post(
  "/admin/orders/:id/expire",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AdminExpireOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const order = await loadOrderForAdmin(params.data.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    try {
      const nextStatus = applyTransition(order.status, "expired", "admin");
      const [updated] = await db
        .update(ordersTable)
        .set({ status: nextStatus })
        .where(eq(ordersTable.id, order.id))
        .returning();

      await logAdminAction({
        adminId: req.currentUser!.id,
        orderId: order.id,
        action: "expire_order",
        details: parseAdminNotes(req.body) ?? "Manual order expiry",
      });

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
  "/admin/disputes/:id/resolve",
  requireAdmin,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const disputeId = parseInt(rawId ?? "", 10);
    if (Number.isNaN(disputeId)) {
      res.status(400).json({ error: "Invalid dispute id" });
      return;
    }

    const parsed = ResolveDisputeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [dispute] = await db
      .select()
      .from(disputesTable)
      .where(eq(disputesTable.id, disputeId));

    if (!dispute) {
      res.status(404).json({ error: "Dispute not found" });
      return;
    }

    let [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, dispute.orderId));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.status !== "disputed" && order.status !== "post_release_disputed") {
      res.status(409).json({ error: "Order is not in disputed status" });
      return;
    }

    const { targetStatus, resolution, buyerAmount, supplierAmount } = parsed.data;
    const [supplier] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, order.supplierId));

    const escrowAvailable =
      Number(order.totalAmount) - Number(order.platformFee);

    try {
      if (buyerAmount && supplierAmount) {
        const buyerAmt = Number(buyerAmount);
        const supplierAmt = Number(supplierAmount);
        if (
          Number.isNaN(buyerAmt) ||
          Number.isNaN(supplierAmt) ||
          buyerAmt <= 0 ||
          supplierAmt <= 0
        ) {
          res.status(400).json({ error: "Split amounts must be positive numbers" });
          return;
        }
        if (buyerAmt + supplierAmt > escrowAvailable + 0.001) {
          res.status(400).json({
            error: `Split total exceeds escrow available (${escrowAvailable.toFixed(2)} GHS)`,
          });
          return;
        }

        await initiateOrderRefund(order, "admin", {
          amount: buyerAmount,
          skipStatusTransition: true,
        });

        [order] = await db
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.id, order.id));

        await initiateOrderPayout(
          order!,
          supplier?.payoutMomoNumber ?? "",
          "admin",
          { amount: supplierAmount },
        );
      } else if (
        targetStatus === "completed" ||
        targetStatus === "payout_processing" ||
        targetStatus === "shipped"
      ) {
        if (order.status === "disputed" || order.status === "post_release_disputed") {
          applyTransition(order.status, "shipped", "admin");
          await db
            .update(ordersTable)
            .set({ status: "shipped" })
            .where(eq(ordersTable.id, order.id));
          [order] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, order.id));
        }
        await initiateOrderPayout(
          order!,
          supplier?.payoutMomoNumber ?? "",
          "admin",
        );
      } else if (targetStatus === "expired") {
        await initiateOrderRefund(order, "admin");
      } else {
        const nextStatus = applyTransition(order.status, targetStatus, "admin");
        await db
          .update(ordersTable)
          .set({ status: nextStatus })
          .where(eq(ordersTable.id, order.id));
      }
    } catch (err) {
      if (err instanceof InvalidOrderTransitionError || err instanceof PaymentInProgressError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes("payout mobile money")) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const [updatedDispute] = await db
      .update(disputesTable)
      .set({
        status: "resolved",
        resolution,
        resolvedByAdminId: req.currentUser!.id,
      })
      .where(eq(disputesTable.id, disputeId))
      .returning();

    await logAdminAction({
      adminId: req.currentUser!.id,
      orderId: order.id,
      action: "resolve_dispute",
      details: resolution,
    });

    const [finalOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order.id));
    if (finalOrder) {
      fireAndForget(notifyDisputeResolved(finalOrder, resolution), "dispute_resolved");
    }

    res.json(updatedDispute);
  },
);

export default router;
