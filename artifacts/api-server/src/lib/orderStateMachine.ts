/**
 * Order state machine — pure module, no I/O, no DB calls.
 *
 * This is the single source of truth for what order-status transitions are
 * legal. Routes/webhooks must call `applyTransition` (or `canTransition`)
 * instead of writing a new `status` value directly — the escrow status
 * must never be inferred or mutated ad hoc from route code.
 */

export const ORDER_STATUSES = [
  "pending_supplier_confirmation",
  "awaiting_payment",
  "payment_processing",
  "in_escrow",
  "shipped",
  "payout_processing",
  "completed",
  "disputed",
  "post_release_disputed",
  "expired",
  "rejected",
  "payout_failed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Who is initiating the transition. Used to gate admin-only overrides. */
export type TransitionActor = "buyer" | "supplier" | "system" | "admin";

/**
 * Normal (non-admin) transition graph. Collections and disbursements both
 * use async pending sub-states (`payment_processing`, `payout_processing`)
 * that only resolve to terminal money states via webhook or polling fallback.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_supplier_confirmation: ["awaiting_payment", "expired", "rejected"],
  awaiting_payment: ["payment_processing", "expired"],
  payment_processing: ["in_escrow", "awaiting_payment"],
  in_escrow: ["shipped", "disputed"],
  shipped: ["payout_processing", "disputed"],
  payout_processing: ["completed", "payout_failed"],
  disputed: [],
  post_release_disputed: [],
  completed: ["post_release_disputed"],
  expired: [],
  rejected: [],
  payout_failed: ["payout_processing", "disputed"],
};

const ADMIN_DISPUTE_RESOLUTIONS: readonly OrderStatus[] = [
  "completed",
  "expired",
  "shipped",
  "payout_processing",
  "payout_failed",
  "post_release_disputed",
];

const ADMIN_MANUAL_EXPIRE_FROM: readonly OrderStatus[] = [
  "pending_supplier_confirmation",
  "awaiting_payment",
  "payment_processing",
  "in_escrow",
  "shipped",
  "payout_failed",
  "post_release_disputed",
];

const ADMIN_REFUND_FROM: readonly OrderStatus[] = [
  "awaiting_payment",
  "in_escrow",
  "shipped",
  "disputed",
  "post_release_disputed",
];

const ADMIN_RELEASE_FROM: readonly OrderStatus[] = [
  "in_escrow",
  "shipped",
  "payout_failed",
  "post_release_disputed",
];

export class InvalidOrderTransitionError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;

  constructor(from: OrderStatus, to: OrderStatus, actor: TransitionActor) {
    super(
      `Invalid order transition: ${from} -> ${to} (actor: ${actor}) is not permitted`,
    );
    this.name = "InvalidOrderTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor = "system",
): boolean {
  if (from === to) return true;

  if (actor === "admin" && (from === "disputed" || from === "post_release_disputed")) {
    return ADMIN_DISPUTE_RESOLUTIONS.includes(to);
  }

  if (actor === "admin" && to === "expired") {
    return (
      ADMIN_MANUAL_EXPIRE_FROM.includes(from) || ADMIN_REFUND_FROM.includes(from)
    );
  }

  if (actor === "admin" && to === "payout_processing") {
    return ADMIN_RELEASE_FROM.includes(from) || from === "disputed";
  }

  return TRANSITIONS[from].includes(to);
}

export function applyTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor = "system",
): OrderStatus {
  if (!canTransition(from, to, actor)) {
    throw new InvalidOrderTransitionError(from, to, actor);
  }
  return to;
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}
