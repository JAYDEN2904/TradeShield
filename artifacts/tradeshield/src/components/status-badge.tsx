import { OrderStatus } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = {
    [OrderStatus.pending_supplier_confirmation]: { label: "Pending Confirmation", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    [OrderStatus.awaiting_payment]: { label: "Awaiting Payment", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    [OrderStatus.payment_processing]: { label: "Payment Processing", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
    [OrderStatus.in_escrow]: { label: "In Escrow", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" },
    [OrderStatus.shipped]: { label: "Shipped", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400" },
    [OrderStatus.completed]: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    [OrderStatus.disputed]: { label: "Disputed", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    [OrderStatus.expired]: { label: "Expired", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
    [OrderStatus.payout_failed]: { label: "Payout Failed", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  };

  const { label, color } = config[status] || { label: status, color: "bg-gray-100 text-gray-800" };

  return (
    <Badge className={`${color} hover:${color} border-0`} variant="outline" data-testid={`status-${status}`}>
      {label}
    </Badge>
  );
}
