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

export const kycDocTypeEnum = pgEnum("kyc_doc_type", [
  "ghana_card_front",
  "ghana_card_back",
]);

export const kycDocStatusEnum = pgEnum("kyc_doc_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const kycDocumentsTable = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  docType: kycDocTypeEnum("doc_type").notNull(),
  storageUrl: text("storage_url").notNull(),
  status: kycDocStatusEnum("status").notNull().default("pending"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertKycDocumentSchema = createInsertSchema(kycDocumentsTable).omit({
  id: true,
  uploadedAt: true,
});
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type KycDocument = typeof kycDocumentsTable.$inferSelect;
