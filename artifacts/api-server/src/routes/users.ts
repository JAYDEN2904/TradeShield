import { Router, type IRouter } from "express";
import { eq, and, avg, count } from "drizzle-orm";
import { db, usersTable, ordersTable, ratingsTable } from "@workspace/db";
import {
  GetUserParams,
  GetUserResponse,
  GetSupplierStatsParams,
  GetSupplierStatsResponse,
  ListUserRatingsParams,
  ListUserRatingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

  const [ratingAgg] = await db
    .select({ averageRating: avg(ratingsTable.stars) })
    .from(ratingsTable)
    .where(eq(ratingsTable.rateeId, params.data.id));

  const totalOrders = totals?.totalOrders ?? 0;
  const completedOrders = completed?.completedOrders ?? 0;

  res.json(
    GetSupplierStatsResponse.parse({
      totalOrders,
      completedOrders,
      completionRate: totalOrders > 0 ? completedOrders / totalOrders : 0,
      averageRating: ratingAgg?.averageRating
        ? Number(ratingAgg.averageRating)
        : null,
    }),
  );
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
