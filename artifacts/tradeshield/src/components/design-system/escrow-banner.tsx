import { ShieldCheck } from "lucide-react";
import { OrderStatus, type OrderStatus as OrderStatusType } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { formatGhs, formatOrderId } from "@/lib/format";
import { OrderStatusBadge } from "@/components/status-badge";

export type EscrowBannerProps = {
  status: OrderStatusType;
  orderId: number;
  amount: string;
  className?: string;
};

/**
 * Prominent trust signal when funds are held in escrow.
 * Also surfaces payment-processing and disputed states with appropriate messaging.
 */
export function EscrowBanner({ status, orderId, amount, className }: EscrowBannerProps) {
  if (status === OrderStatus.in_escrow) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border-2 border-trust/40 bg-gradient-to-br from-trust-muted via-trust-muted/80 to-background p-6 shadow-ts-md",
          className,
        )}
        role="region"
        aria-label="Escrow status"
      >
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-trust/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-trust text-trust-foreground shadow-ts-sm">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-trust">
                Funds secured
              </p>
              <h2 className="font-serif text-2xl font-semibold text-foreground mt-0.5">
                {formatGhs(amount)} in escrow
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Payment for order {formatOrderId(orderId)} is held safely until delivery is
                confirmed. Neither party can access these funds until then.
              </p>
            </div>
          </div>
          <OrderStatusBadge status={status} size="lg" />
        </div>
      </div>
    );
  }

  if (status === OrderStatus.payment_processing) {
    return (
      <div
        className={cn(
          "rounded-xl border border-violet-200/80 bg-violet-50/80 p-5 dark:border-violet-800/50 dark:bg-violet-950/30",
          className,
        )}
        role="status"
      >
        <div className="flex items-start gap-3">
          <OrderStatusBadge status={status} size="lg" />
          <div>
            <p className="font-medium text-foreground">Complete payment on your phone</p>
            <p className="text-sm text-muted-foreground mt-1">
              Approve the mobile money prompt to move {formatGhs(amount)} into escrow for{" "}
              {formatOrderId(orderId)}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === OrderStatus.disputed || status === OrderStatus.post_release_disputed) {
    return (
      <div
        className={cn(
          "rounded-xl border border-red-200/80 bg-red-50/60 p-5 dark:border-red-900/50 dark:bg-red-950/20",
          className,
        )}
        role="status"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">
              {status === OrderStatus.post_release_disputed
                ? "Post-release dispute under review"
                : "Escrow release paused"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {status === OrderStatus.post_release_disputed
                ? "Admin is reviewing this dispute filed after auto-release."
                : `${formatGhs(amount)} remains held while this dispute is reviewed.`}
            </p>
          </div>
          <OrderStatusBadge status={status} size="lg" />
        </div>
      </div>
    );
  }

  if (status === OrderStatus.payout_processing) {
    return (
      <div
        className={cn(
          "rounded-xl border border-amber-200/80 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/20",
          className,
        )}
        role="status"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Releasing payment to supplier</p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatGhs(amount)} is being disbursed. This usually completes within a few moments.
            </p>
          </div>
          <OrderStatusBadge status={status} size="lg" />
        </div>
      </div>
    );
  }

  return null;
}
