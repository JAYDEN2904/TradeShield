/** Shared order ID formatting for SMS copy. */
export function formatOrderId(orderId: number): string {
  return `#${orderId.toString().padStart(6, "0")}`;
}
