import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import { OrderStatus, type OrderStatus as OrderStatusType } from "@workspace/api-client-react";

export type OrderStatusVisual = {
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for badge surface */
  badgeClass: string;
  /** Tailwind classes for icon inside badge */
  iconClass: string;
  /** Whether this status deserves prominent / hero treatment */
  prominent: boolean;
};

export const ORDER_STATUS_CONFIG: Record<OrderStatusType, OrderStatusVisual> = {
  [OrderStatus.pending_supplier_confirmation]: {
    label: "Awaiting Confirmation",
    shortLabel: "Pending",
    description: "Waiting for the supplier to confirm this order.",
    icon: Clock,
    badgeClass:
      "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60",
    iconClass: "text-amber-600 dark:text-amber-400",
    prominent: false,
  },
  [OrderStatus.awaiting_payment]: {
    label: "Awaiting Payment",
    shortLabel: "Pay Now",
    description: "Supplier confirmed. Complete payment to secure funds in escrow.",
    icon: Wallet,
    badgeClass:
      "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700/60",
    iconClass: "text-slate-600 dark:text-slate-400",
    prominent: false,
  },
  [OrderStatus.payment_processing]: {
    label: "Payment Processing",
    shortLabel: "Processing",
    description: "Approve the mobile money prompt on your phone to continue.",
    icon: Loader2,
    badgeClass:
      "bg-violet-50 text-violet-900 ring-1 ring-violet-200/80 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800/60",
    iconClass: "text-violet-600 dark:text-violet-400 animate-spin",
    prominent: false,
  },
  [OrderStatus.in_escrow]: {
    label: "Secured in Escrow",
    shortLabel: "In Escrow",
    description: "Funds are held safely until delivery is confirmed.",
    icon: ShieldCheck,
    badgeClass:
      "bg-teal-50 text-teal-950 ring-2 ring-teal-300/90 shadow-sm dark:bg-teal-950/50 dark:text-teal-100 dark:ring-teal-600/70",
    iconClass: "text-teal-600 dark:text-teal-400",
    prominent: true,
  },
  [OrderStatus.shipped]: {
    label: "Shipped",
    shortLabel: "Shipped",
    description: "Goods are on the way. Confirm receipt to release payment.",
    icon: Truck,
    badgeClass:
      "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800/60",
    iconClass: "text-sky-600 dark:text-sky-400",
    prominent: false,
  },
  [OrderStatus.payout_processing]: {
    label: "Releasing Payment",
    shortLabel: "Payout Processing",
    description: "Funds are being disbursed to the supplier. This usually takes a moment.",
    icon: Loader2,
    badgeClass:
      "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60",
    iconClass: "text-amber-600 dark:text-amber-400 animate-spin",
    prominent: true,
  },
  [OrderStatus.completed]: {
    label: "Completed",
    shortLabel: "Complete",
    description: "Delivery confirmed and supplier has been paid.",
    icon: CheckCircle2,
    badgeClass:
      "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/60",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    prominent: false,
  },
  [OrderStatus.disputed]: {
    label: "Disputed",
    shortLabel: "Disputed",
    description: "This order is under review. Escrow release is paused.",
    icon: AlertTriangle,
    badgeClass:
      "bg-red-50 text-red-900 ring-1 ring-red-200/80 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800/60",
    iconClass: "text-red-600 dark:text-red-400",
    prominent: true,
  },
  [OrderStatus.post_release_disputed]: {
    label: "Post-release dispute",
    shortLabel: "Post-release",
    description: "Dispute filed after auto-release. Admin mediation required.",
    icon: AlertTriangle,
    badgeClass:
      "bg-red-50 text-red-900 ring-1 ring-red-200/80 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800/60",
    iconClass: "text-red-600 dark:text-red-400",
    prominent: true,
  },
  [OrderStatus.rejected]: {
    label: "Rejected",
    shortLabel: "Rejected",
    description: "Supplier declined this order.",
    icon: XCircle,
    badgeClass:
      "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200/80 dark:bg-neutral-800/60 dark:text-neutral-300 dark:ring-neutral-700/60",
    iconClass: "text-neutral-500 dark:text-neutral-400",
    prominent: false,
  },
  [OrderStatus.expired]: {
    label: "Expired",
    shortLabel: "Expired",
    description: "This order was closed without completing payment.",
    icon: XCircle,
    badgeClass:
      "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200/80 dark:bg-neutral-800/60 dark:text-neutral-300 dark:ring-neutral-700/60",
    iconClass: "text-neutral-500 dark:text-neutral-400",
    prominent: false,
  },
  [OrderStatus.payout_failed]: {
    label: "Payout Failed",
    shortLabel: "Payout Failed",
    description: "Supplier payout could not be completed. Admin follow-up required.",
    icon: AlertCircle,
    badgeClass:
      "bg-red-50 text-red-900 ring-1 ring-red-300/80 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800/60",
    iconClass: "text-red-600 dark:text-red-400",
    prominent: true,
  },
};

export function getOrderStatusConfig(status: OrderStatusType): OrderStatusVisual {
  return ORDER_STATUS_CONFIG[status];
}

/** User-facing milestones for the order timeline */
export const ORDER_TIMELINE_STEPS = [
  { id: "placed", label: "Order placed", detail: "Buyer submitted the order" },
  { id: "confirmed", label: "Supplier confirmed", detail: "Ready for payment" },
  { id: "escrow", label: "Funds in escrow", detail: "Payment secured" },
  { id: "shipped", label: "Shipped", detail: "Goods dispatched" },
  { id: "complete", label: "Complete", detail: "Funds released" },
] as const;

export type TimelineStepId = (typeof ORDER_TIMELINE_STEPS)[number]["id"];

export function getTimelineStepIndex(status: OrderStatusType): number {
  switch (status) {
    case OrderStatus.pending_supplier_confirmation:
      return 0;
    case OrderStatus.awaiting_payment:
    case OrderStatus.payment_processing:
      return 1;
    case OrderStatus.in_escrow:
    case OrderStatus.disputed:
    case OrderStatus.post_release_disputed:
      return 2;
    case OrderStatus.shipped:
    case OrderStatus.payout_failed:
      return 3;
    case OrderStatus.payout_processing:
    case OrderStatus.completed:
      return 4;
    case OrderStatus.expired:
    case OrderStatus.rejected:
      return -1;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
