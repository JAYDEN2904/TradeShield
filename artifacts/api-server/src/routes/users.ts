import { Router, type IRouter } from "express";
import { eq, and, avg, count, inArray } from "drizzle-orm";
import { db, usersTable, ordersTable, ratingsTable } from "@workspace/db";
import {
  GetUserParams,
  GetUserResponse,
  GetSupplierStatsParams,
  GetSupplierStatsResponse,
  ListUserRatingsParams,
  ListUserRatingsResponse,
  GetSupplierDashboardQueryParams,
  GetSupplierDashboardResponse,
} from "@workspace/api-zod";
import { computeSupplierStats, TERMINAL_STATUSES } from "../lib/supplierTrust";
import { buildSupplierDashboard, type EarningsPeriod } from "../lib/supplierDashboard";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Must be registered before /users/:id to avoid "me" being parsed as an integer id
router.get("/users/me/supplier-dashboard", requireAuth, async (req, res): Promise<void> => {
  const user = req.currentUser!;

  if (user.role === "buyer") {
    res.status(403).json({ error: "Supplier dashboard is only available to supplier accounts." });
    return;
  }

  const query = GetSupplierDashboardQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const period = (query.data.earningsPeriod ?? "month") as EarningsPeriod;
  const dashboard = await buildSupplierDashboard(user.id, period);
  res.json(GetSupplierDashboardResponse.parse(dashboard));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetUserResponse.parse(user));
});

router.get("/users/:id/stats", async (req, res): Promise<void> => {
  const params = GetSupplierStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [totals] = await db
    .select({ totalOrders: count() })
    .from(ordersTable)
    .where(eq(ordersTable.supplierId, params.data.id));

  const [completed] = await db
    .select({ completedOrders: count() })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.supplierId, params.data.id),
        eq(ordersTable.status, "completed"),
      ),
    );

  const [terminal] = await db
    .select({ terminalOrders: count() })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.supplierId, params.data.id),
        inArray(ordersTable.status, [...TERMINAL_STATUSES]),
      ),
    );

  const [ratingAgg] = await db
    .select({ averageRating: avg(ratingsTable.stars) })
    .from(ratingsTable)
    .where(eq(ratingsTable.rateeId, params.data.id));

  const stats = computeSupplierStats({
    totalOrders: totals?.totalOrders ?? 0,
    completedOrders: completed?.completedOrders ?? 0,
    terminalOrders: terminal?.terminalOrders ?? 0,
    averageRating: ratingAgg?.averageRating
      ? Number(ratingAgg.averageRating)
      : null,
  });

  res.json(GetSupplierStatsResponse.parse(stats));
});

router.get("/users/:id/ratings", async (req, res): Promise<void> => {
  const params = ListUserRatingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ratings = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.rateeId, params.data.id))
    .orderBy(ratingsTable.createdAt);

  res.json(ListUserRatingsResponse.parse(ratings));
});

export default router;
