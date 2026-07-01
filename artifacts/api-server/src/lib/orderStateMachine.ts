/**
 * Order state machine — pure module, no I/O, no DB calls.
 *
 * This is the single source of truth for what order-status transitions are
 * legal. Routes/webhooks must call `applyTransition` (or `canTransition`)
 * instead of writing a new `status` value directly — the escrow status
 * must never be inferred or mutated ad hoc from route code.
 *
 * All order statuses, verbatim from the product spec:
 *   pending_supplier_confirmation, awaiting_payment, payment_processing,
 *   in_escrow, shipped, completed, disputed, expired, payout_failed
 */

export const ORDER_STATUSES = [
  "pending_supplier_confirmation",
  "awaiting_payment",
  "payment_processing",
  "in_escrow",
  "shipped",
  "completed",
  "disputed",
  "expired",
  "payout_failed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Who is initiating the transition. Used to gate admin-only overrides. */
export type TransitionActor = "buyer" | "supplier" | "system" | "admin";

/**
 * Normal (non-admin) transition graph. Every key lists the statuses it may
 * move to as part of the regular core-loop flow. Terminal statuses
 * (`completed`, `expired`) have no normal outgoing edges — only an admin
 * override can move an order out of them (e.g. a post-completion refund
 * dispute).
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_supplier_confirmation: ["awaiting_payment", "expired"],
  awaiting_payment: ["payment_processing", "expired"],
  payment_processing: ["in_escrow", "awaiting_payment"],
  in_escrow: ["shipped", "disputed"],
  shipped: ["completed", "disputed", "payout_failed"],
  disputed: [],
  completed: [],
  expired: [],
  payout_failed: ["shipped", "disputed"],
};

/**
 * Statuses an admin may resolve a dispute into. Modeled separately from
 * `TRANSITIONS` because dispute resolution is a manual override, not a
 * system-driven transition — it can move an order to any terminal or
 * recovery state regardless of the normal graph.
 */
const ADMIN_DISPUTE_RESOLUTIONS: readonly OrderStatus[] = [
  "completed",
  "expired",
  "shipped",
  "payout_failed",
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

/**
 * Returns true if `from -> to` is a legal transition for the given actor.
 * Same-status "transitions" (from === to) are always allowed — webhooks
 * and cron jobs may be retried/delivered twice, and re-applying the same
 * status must be a no-op rather than an error.
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor = "system",
): boolean {
  if (from === to) return true;

  if (actor === "admin" && from === "disputed") {
    return ADMIN_DISPUTE_RESOLUTIONS.includes(to);
  }

  return TRANSITIONS[from].includes(to);
}

/**
 * Validates and "applies" a transition by returning the resulting status.
 * Callers persist the returned status themselves (this module does no I/O).
 * Throws `InvalidOrderTransitionError` if the transition is not permitted.
 *
 * Idempotent: calling with `to === from` always succeeds and returns `from`
 * unchanged, so double-delivered webhooks are safe to replay.
 */
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

/** True once an order can no longer change status through normal flow. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** All statuses reachable in one normal (non-admin) hop from `from`. */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}
