import { and, avg, count, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  db,
  disputesTable,
  ordersTable,
  productsTable,
  ratingsTable,
  type Order,
  usersTable,
} from "@workspace/db";
import { computeSupplierStats, TERMINAL_STATUSES } from "./supplierTrust";

export type EarningsPeriod = "week" | "month" | "all";

const ACTION_STATUSES = [
  "pending_supplier_confirmation",
  "in_escrow",
  "payout_failed",
  "disputed",
] as const satisfies Order["status"][];

function periodStart(period: EarningsPeriod): Date | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
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
  const [dispute] = await db
    .select()
    .from(disputesTable)
    .where(eq(disputesTable.orderId, order.id))
    .orderBy(disputesTable.createdAt);

  return { ...order, product, buyer, supplier, dispute: dispute ?? null };
}

export async function buildSupplierDashboard(
  supplierId: number,
  period: EarningsPeriod,
) {
  // --- earnings ---
  const start = periodStart(period);

  const earnedConditions = [
    eq(ordersTable.supplierId, supplierId),
    eq(ordersTable.status, "completed"),
  ];
  if (start) earnedConditions.push(gte(ordersTable.createdAt, start));

  const [earnedRow] = await db
    .select({
      earned: sql<string>`coalesce(sum(${ordersTable.totalAmount} - ${ordersTable.platformFee}), 0)`,
    })
    .from(ordersTable)
    .where(and(...earnedConditions));

  const [escrowRow] = await db
    .select({
      inEscrow: sql<string>`coalesce(sum(${ordersTable.totalAmount}), 0)`,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.supplierId, supplierId),
        inArray(ordersTable.status, ["in_escrow", "shipped"]),
      ),
    );

  const [pendingRow] = await db
    .select({
      pending: sql<string>`coalesce(sum(${ordersTable.totalAmount}), 0)`,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.supplierId, supplierId),
        eq(ordersTable.status, "payout_processing"),
      ),
    );

  // --- action + recent orders ---
  const allSupplierOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.supplierId, supplierId))
    .orderBy(sql`${ordersTable.createdAt} desc`);

  const actionOrders = allSupplierOrders.filter((o) =>
    (ACTION_STATUSES as readonly string[]).includes(o.status),
  );
  const recentOrders = allSupplierOrders.slice(0, 5);

  const [needsAction, recent] = await Promise.all([
    Promise.all(actionOrders.map(loadOrderDetail)),
    Promise.all(recentOrders.map(loadOrderDetail)),
  ]);

  // --- catalog ---
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.supplierId, supplierId));

  const activeProducts = products.filter((p) => p.isActive);
  const catalog = {
    activeCount: activeProducts.length,
    inactiveCount: products.filter((p) => !p.isActive).length,
    outOfStockCount: activeProducts.filter((p) => p.stockQty === 0).length,
    lowStockCount: activeProducts.filter(
      (p) => p.stockQty > 0 && p.stockQty < p.moq,
    ).length,
  };

  // --- trust stats ---
  const [totals] = await db
    .select({ totalOrders: count() })
    .from(ordersTable)
    .where(eq(ordersTable.supplierId, supplierId));

  const [completed] = await db
    .select({ completedOrders: count() })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.supplierId, supplierId),
        eq(ordersTable.status, "completed"),
      ),
    );

  const [terminal] = await db
    .select({ terminalOrders: count() })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.supplierId, supplierId),
        inArray(ordersTable.status, [...TERMINAL_STATUSES]),
      ),
    );

  const [ratingAgg] = await db
    .select({ averageRating: avg(ratingsTable.stars) })
    .from(ratingsTable)
    .where(eq(ratingsTable.rateeId, supplierId));

  const trust = computeSupplierStats({
    totalOrders: totals?.totalOrders ?? 0,
    completedOrders: completed?.completedOrders ?? 0,
    terminalOrders: terminal?.terminalOrders ?? 0,
    averageRating: ratingAgg?.averageRating
      ? Number(ratingAgg.averageRating)
      : null,
  });

  return {
    earnings: {
      period,
      earnedGhs: earnedRow?.earned ?? "0",
      inEscrowGhs: escrowRow?.inEscrow ?? "0",
      pendingReleaseGhs: pendingRow?.pending ?? "0",
    },
    needsAction,
    recentOrders: recent,
    catalog,
    trust,
    onboarding: {
      hasProducts: products.length > 0,
      hasCompletedOrder: (completed?.completedOrders ?? 0) > 0,
    },
  };
}
