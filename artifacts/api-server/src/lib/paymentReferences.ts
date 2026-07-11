/** Platform-generated Moolre reference strings — unique per attempt, traceable to order. */

export function buildCollectionReference(
  orderId: number,
  attempt: number,
): string {
  return `ORDER-${orderId}-PAY-${attempt}`;
}

export function buildDisbursementReference(
  orderId: number,
  attempt: number,
): string {
  return `ORDER-${orderId}-PAYOUT-${attempt}`;
}

export function buildRefundReference(orderId: number, attempt: number): string {
  return `ORDER-${orderId}-REFUND-${attempt}`;
}

export function parseOrderIdFromReference(reference: string): number | null {
  const match = /^ORDER-(\d+)-(?:PAY|PAYOUT|REFUND)-\d+$/.exec(reference);
  if (!match?.[1]) return null;
  const id = parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}
