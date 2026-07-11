import { db, adminActionsTable, type InsertAdminAction } from "@workspace/db";

export async function logAdminAction(
  input: Omit<InsertAdminAction, "id" | "createdAt">,
): Promise<void> {
  await db.insert(adminActionsTable).values(input);
}
