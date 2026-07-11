import type { SupplierStats } from "@workspace/api-client-react";
import { NEW_SUPPLIER_ORDER_THRESHOLD } from "./catalog-constants";

export { NEW_SUPPLIER_ORDER_THRESHOLD };

export function formatCompletionRate(stats: SupplierStats): string {
  if (!stats.hasTransactionHistory || stats.completionRate == null) {
    return "No transaction history yet";
  }
  return `${Math.round(stats.completionRate * 100)}% completion`;
}

export function formatSupplierRating(stats: SupplierStats): string {
  if (stats.averageRating != null) {
    return stats.averageRating.toFixed(1);
  }
  if (stats.isNewSupplier) {
    return "New supplier";
  }
  return "No ratings yet";
}

export function supplierTrustLabel(completedOrders: number): string | null {
  if (completedOrders < NEW_SUPPLIER_ORDER_THRESHOLD) {
    return "New Supplier";
  }
  return null;
}
