import {
  pgTable,
  serial,
  text,
  timestamp,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["buyer", "supplier", "both"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  role: userRoleEnum("role").notNull().default("buyer"),
  businessName: text("business_name").notNull(),
  location: text("location").notNull(),
  category: text("category"),
  payoutMomoNumber: text("payout_momo_number"),
  // Admin is a flag, not a role value, so a buyer/supplier/both user can
  // also be an admin. No self-serve signup path sets this — seeded/updated
  // directly in the DB for the MVP.
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
