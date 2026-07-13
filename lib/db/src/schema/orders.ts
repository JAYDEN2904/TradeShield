import {
  pgTable,
  serial,
  integer,
  numeric,
  timestamp,
  pgEnum,
  text,
  boolean,
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
  "payout_processing",
  "completed",
  "disputed",
  "post_release_disputed",
  "expired",
  "rejected",
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
  deliveryLocation: text("delivery_location"),
  preferredDeliveryDate: timestamp("preferred_delivery_date", {
    withTimezone: true,
  }),
  rejectReason: text("reject_reason"),
  /** Supplier must respond before this time or the order auto-expires (24h). */
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  autoReleaseReminderSent: boolean("auto_release_reminder_sent")
    .notNull()
    .default(false),
  /** Optional photo URL attached by buyer at confirm-receipt. */
  confirmPhotoUrl: text("confirm_photo_url"),
  /** MoMo number used for the buyer's escrow collection (may differ from account phone). */
  paymentMomoNumber: text("payment_momo_number"),
  /** Network selected at pay time: mtn | telecel | airteltigo */
  paymentMomoProvider: text("payment_momo_provider"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderStatus = Order["status"];
