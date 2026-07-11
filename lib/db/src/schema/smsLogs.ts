import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

export const smsLogsTable = pgTable("sms_logs", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  template: text("template").notNull(),
  body: text("body").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSmsLogSchema = createInsertSchema(smsLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSmsLog = z.infer<typeof insertSmsLogSchema>;
export type SmsLog = typeof smsLogsTable.$inferSelect;
