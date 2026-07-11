import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const adminActionTypeEnum = pgEnum("admin_action_type", [
  "release_funds",
  "refund",
  "retry_payout",
  "expire_order",
  "resolve_dispute",
]);

export const adminActionsTable = pgTable("admin_actions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => usersTable.id),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id),
  action: adminActionTypeEnum("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAdminActionSchema = createInsertSchema(adminActionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminAction = z.infer<typeof insertAdminActionSchema>;
export type AdminAction = typeof adminActionsTable.$inferSelect;
