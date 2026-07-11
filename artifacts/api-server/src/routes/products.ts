import { Router, type IRouter } from "express";
import { eq, and, or, ilike, inArray, avg, count } from "drizzle-orm";
import { db, productsTable, usersTable, ordersTable, ratingsTable } from "@workspace/db";
import {
  ListProductsQueryParams,
  ListProductsResponse,
  CreateProductBody,
  CreateProductResponse,
  GetProductParams,
  GetProductResponse,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  DeleteProductParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { NEW_SUPPLIER_ORDER_THRESHOLD } from "../lib/supplierTrust";

const router: IRouter = Router();

async function completedOrdersBySupplier(
  supplierIds: number[],
): Promise<Map<number, number>> {
  if (supplierIds.length === 0) return new Map();

  const rows = await db
    .select({
      supplierId: ordersTable.supplierId,
      completedOrders: count(),
    })
    .from(ordersTable)
    .where(
      and(
        inArray(ordersTable.supplierId, supplierIds),
        eq(ordersTable.status, "completed"),
      ),
    )
    .groupBy(ordersTable.supplierId);

  return new Map(rows.map((r) => [r.supplierId, r.completedOrders]));
}

async function averageRatingBySupplier(
  supplierIds: number[],
): Promise<Map<number, number>> {
  if (supplierIds.length === 0) return new Map();

  const rows = await db
    .select({
      rateeId: ratingsTable.rateeId,
      averageRating: avg(ratingsTable.stars),
    })
    .from(ratingsTable)
    .where(inArray(ratingsTable.rateeId, supplierIds))
    .groupBy(ratingsTable.rateeId);

  return new Map(
    rows.map((r) => [r.rateeId, Number(r.averageRating ?? 0)]),
  );
}

router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];

  if (query.data.supplierId != null) {
    conditions.push(eq(productsTable.supplierId, query.data.supplierId));
  } else {
    conditions.push(eq(productsTable.isActive, true));
  }

  if (query.data.category) {
    conditions.push(eq(productsTable.category, query.data.category));
  }

  if (query.data.location) {
    conditions.push(ilike(usersTable.location, `%${query.data.location}%`));
  }

  if (query.data.search) {
    const term = `%${query.data.search}%`;
    conditions.push(
      or(
        ilike(productsTable.name, term),
        ilike(usersTable.businessName, term),
      )!,
    );
  }

  const rows = await db
    .select({
      product: productsTable,
      supplierBusinessName: usersTable.businessName,
      supplierLocation: usersTable.location,
    })
    .from(productsTable)
    .innerJoin(usersTable, eq(usersTable.id, productsTable.supplierId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.createdAt);

  const supplierIds = [...new Set(rows.map((r) => r.product.supplierId))];
  const completedMap = await completedOrdersBySupplier(supplierIds);
  const ratingMap = await averageRatingBySupplier(supplierIds);

  const catalog = rows.map(({ product, supplierBusinessName, supplierLocation }) => {
    const supplierCompletedOrders = completedMap.get(product.supplierId) ?? 0;
    const supplierAverageRating = ratingMap.get(product.supplierId) ?? null;

    return {
      ...product,
      supplierBusinessName: supplierBusinessName ?? "Supplier",
      supplierLocation: supplierLocation ?? "",
      supplierCompletedOrders,
      supplierAverageRating,
      supplierIsNew: supplierCompletedOrders < NEW_SUPPLIER_ORDER_THRESHOLD,
    };
  });

  res.json(ListProductsResponse.parse(catalog));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({ ...parsed.data, supplierId: req.currentUser!.id })
    .returning();

  res.status(201).json(CreateProductResponse.parse(product));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(GetProductResponse.parse(product));
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (existing.supplierId !== req.currentUser!.id) {
    res.status(403).json({ error: "Not the owning supplier" });
    return;
  }

  const [product] = await db
    .update(productsTable)
    .set(parsed.data)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  res.json(UpdateProductResponse.parse(product));
});

router.delete(
  "/products/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, params.data.id));

    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    if (existing.supplierId !== req.currentUser!.id) {
      res.status(403).json({ error: "Not the owning supplier" });
      return;
    }

    const [product] = await db
      .update(productsTable)
      .set({ isActive: false })
      .where(eq(productsTable.id, params.data.id))
      .returning();

    res.json(UpdateProductResponse.parse(product));
  },
);

export default router;
