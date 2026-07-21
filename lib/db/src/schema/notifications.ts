import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    orderId: integer("order_id").references(() => ordersTable.id),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("notifications_user_id_read_at_idx").on(table.userId, table.readAt),
  ],
);

export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
