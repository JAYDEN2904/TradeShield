export const NEW_SUPPLIER_ORDER_THRESHOLD = 5;

const TERMINAL_STATUSES = ["completed", "disputed", "expired"] as const;

export function computeSupplierStats(input: {
  totalOrders: number;
  completedOrders: number;
  terminalOrders: number;
  averageRating: number | null;
}): {
  totalOrders: number;
  completedOrders: number;
  completionRate: number | null;
  averageRating: number | null;
  isNewSupplier: boolean;
  hasTransactionHistory: boolean;
} {
  const { totalOrders, completedOrders, terminalOrders, averageRating } = input;
  const hasTransactionHistory = terminalOrders > 0;
  const completionRate = hasTransactionHistory
    ? completedOrders / terminalOrders
    : null;

  return {
    totalOrders,
    completedOrders,
    completionRate,
    averageRating,
    isNewSupplier: completedOrders < NEW_SUPPLIER_ORDER_THRESHOLD,
    hasTransactionHistory,
  };
}

export { TERMINAL_STATUSES };
