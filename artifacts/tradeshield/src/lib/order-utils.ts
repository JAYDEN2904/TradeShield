import {
  OrderStatus,
  type Order,
  type OrderStatus as OrderStatusType,
} from "@workspace/api-client-react";
import { getOrderStatusConfig } from "@/lib/order-status-config";

const TERMINAL_STATUSES: OrderStatusType[] = [
  OrderStatus.completed,
  OrderStatus.expired,
  OrderStatus.rejected,
];

export function isTerminalOrderStatus(status: OrderStatusType): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isProcessingStatus(status: OrderStatusType): boolean {
  return (
    status === OrderStatus.payment_processing ||
    status === OrderStatus.payout_processing
  );
}

export function orderNeedsAttention(order: Order, userId: number): boolean {
  const isBuyer = order.buyerId === userId;
  const isSupplier = order.supplierId === userId;

  switch (order.status) {
    case OrderStatus.pending_supplier_confirmation:
      return isSupplier;
    case OrderStatus.awaiting_payment:
    case OrderStatus.payment_processing:
      return isBuyer;
    case OrderStatus.in_escrow:
      return isSupplier;
    case OrderStatus.shipped:
      return isBuyer;
    case OrderStatus.payout_processing:
      return isBuyer || isSupplier;
    case OrderStatus.disputed:
    case OrderStatus.post_release_disputed:
    case OrderStatus.payout_failed:
      return isBuyer || isSupplier;
    case OrderStatus.rejected:
    case OrderStatus.completed:
    case OrderStatus.expired:
      return false;
    default: {
      const _exhaustive: never = order.status;
      return _exhaustive;
    }
  }
}

export function getOrderActionHint(order: Order, userId: number): string | null {
  const isBuyer = order.buyerId === userId;
  const isSupplier = order.supplierId === userId;

  switch (order.status) {
    case OrderStatus.pending_supplier_confirmation:
      return isSupplier ? "Confirm or reject this order" : "Waiting for supplier";
    case OrderStatus.awaiting_payment:
      return isBuyer ? "Pay to secure funds in escrow" : "Waiting for buyer payment";
    case OrderStatus.payment_processing:
      return isBuyer ? "Approve payment on your phone" : "Buyer payment processing";
    case OrderStatus.in_escrow:
      return isSupplier
        ? "Ship goods — payment is secured"
        : "Funds held until you confirm delivery";
    case OrderStatus.shipped:
      return isBuyer
        ? "Confirm receipt to release payment"
        : "Waiting for buyer confirmation";
    case OrderStatus.payout_processing:
      return "Payment releasing to supplier";
    case OrderStatus.disputed:
    case OrderStatus.post_release_disputed:
      return "Under admin review";
    case OrderStatus.rejected:
      return "Supplier rejected this order";
    case OrderStatus.payout_failed:
      return "Payout issue — admin notified";
    case OrderStatus.completed:
    case OrderStatus.expired:
      return getOrderStatusConfig(order.status).description;
    default: {
      const _exhaustive: never = order.status;
      return getOrderStatusConfig(_exhaustive).description;
    }
  }
}

export function sortOrdersByPriority(orders: Order[], userId: number): Order[] {
  const priority = (order: Order): number => {
    if (orderNeedsAttention(order, userId)) {
      if (isProcessingStatus(order.status)) return 0;
      if (order.status === OrderStatus.in_escrow) return 1;
      if (order.status === OrderStatus.awaiting_payment) return 2;
      if (order.status === OrderStatus.shipped) return 3;
      return 4;
    }
    if (isTerminalOrderStatus(order.status)) return 10;
    return 5;
  };

  return [...orders].sort((a, b) => {
    const diff = priority(a) - priority(b);
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function partitionOrders(
  orders: Order[],
  userId: number,
): { attention: Order[]; rest: Order[] } {
  const sorted = sortOrdersByPriority(orders, userId);
  const attention = sorted.filter((o) => orderNeedsAttention(o, userId));
  const attentionIds = new Set(attention.map((o) => o.id));
  const rest = sorted.filter((o) => !attentionIds.has(o.id));
  return { attention, rest };
}
