import {
  pgTable,
  serial,
  integer,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productsTable } from "./products";

// Single source of truth for order lifecycle. The order-state-machine
// module (artifacts/api-server/src/lib/orderStateMachine.ts) is the only
// place allowed to decide whether a transition between these values is
// legal — never infer escrow state from anything other than this column.
export const orderStatusEnum = pgEnum("order_status", [
  "pending_supplier_confirmation",
  "awaiting_payment",
  "payment_processing",
  "in_escrow",
  "shipped",
  "completed",
  "disputed",
  "expired",
  "payout_failed",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id")
    .notNull()
    .references(() => usersTable.id),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => usersTable.id),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  platformFee: numeric("platform_fee", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  status: orderStatusEnum("status")
    .notNull()
    .default("pending_supplier_confirmation"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  autoReleaseAt: timestamp("auto_release_at", { withTimezone: true }),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderStatus = Order["status"];
