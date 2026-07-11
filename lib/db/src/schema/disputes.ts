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
import { ordersTable } from "./orders";
import { usersTable } from "./users";

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "resolved",
]);

export const disputeCategoryEnum = pgEnum("dispute_category", [
  "quality",
  "non_delivery",
  "quantity",
  "other",
]);

export const disputesTable = pgTable("disputes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id),
  raisedBy: integer("raised_by")
    .notNull()
    .references(() => usersTable.id),
  reason: text("reason").notNull(),
  status: disputeStatusEnum("status").notNull().default("open"),
  category: disputeCategoryEnum("category"),
  evidenceUrls: text("evidence_urls").array(),
  resolution: text("resolution"),
  resolvedByAdminId: integer("resolved_by_admin_id").references(
    () => usersTable.id,
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const disputeRepliesTable = pgTable("dispute_replies", {
  id: serial("id").primaryKey(),
  disputeId: integer("dispute_id")
    .notNull()
    .references(() => disputesTable.id),
  authorId: integer("author_id")
    .notNull()
    .references(() => usersTable.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDisputeSchema = createInsertSchema(disputesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type Dispute = typeof disputesTable.$inferSelect;
export type DisputeReply = typeof disputeRepliesTable.$inferSelect;
