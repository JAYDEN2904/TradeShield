import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";
import { applyTransition, InvalidOrderTransitionError } from "../lib/orderStateMachine";

const router: IRouter = Router();

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

  return { ...order, product, buyer, supplier, dispute: dispute ?? null };
}

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

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, dispute.orderId));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    try {
      const nextStatus = applyTransition(order.status, parsed.data.targetStatus, "admin");
      await db
        .update(ordersTable)
        .set({ status: nextStatus })
        .where(eq(ordersTable.id, order.id));
    } catch (err) {
      if (err instanceof InvalidOrderTransitionError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }

    const [updatedDispute] = await db
      .update(disputesTable)
      .set({
        status: "resolved",
        resolution: parsed.data.resolution,
        resolvedByAdminId: req.currentUser!.id,
      })
      .where(eq(disputesTable.id, disputeId))
      .returning();

    res.json(updatedDispute);
  },
);

export default router;
