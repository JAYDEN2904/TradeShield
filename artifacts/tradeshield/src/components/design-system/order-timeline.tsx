import { Check, AlertTriangle } from "lucide-react";
import { OrderStatus, type OrderStatus as OrderStatusType } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  ORDER_TIMELINE_STEPS,
  getTimelineStepIndex,
} from "@/lib/order-status-config";

export type OrderTimelineProps = {
  status: OrderStatusType;
  className?: string;
};

export function OrderTimeline({ status, className }: OrderTimelineProps) {
  const activeIndex = getTimelineStepIndex(status);
  const isExpired = status === OrderStatus.expired;
  const isRejected = status === OrderStatus.rejected;
  const isDisputed =
    status === OrderStatus.disputed || status === OrderStatus.post_release_disputed;
  const isPayoutFailed = status === OrderStatus.payout_failed;

  if (isExpired) {
    return (
      <div className={cn("w-full", className)} aria-label="Order progress">
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
          This order expired before completing the trade flow.
        </p>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className={cn("w-full", className)} aria-label="Order progress">
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
          Supplier rejected this order before payment.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)} aria-label="Order progress">
      {(isDisputed || isPayoutFailed) && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
            isDisputed
              ? "bg-red-50 text-red-800 border border-red-200/80 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900/50"
              : "bg-amber-50 text-amber-900 border border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50",
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {isDisputed
            ? status === OrderStatus.post_release_disputed
              ? "Post-release dispute — admin mediation in progress."
              : "Dispute open — escrow release is paused pending admin review."
            : "Payout failed — funds remain held until resolved."}
        </div>
      )}

      <ol className="relative flex flex-col gap-0 sm:flex-row sm:justify-between">
        {ORDER_TIMELINE_STEPS.map((step, index) => {
          const isComplete = activeIndex > index;
          const isCurrent = activeIndex === index;
          const isUpcoming = activeIndex < index;
          const isEscrowStep = step.id === "escrow";

          return (
            <li
              key={step.id}
              className={cn(
                "relative flex flex-1 flex-row items-start gap-3 pb-6 sm:flex-col sm:items-center sm:pb-0 sm:text-center",
                index < ORDER_TIMELINE_STEPS.length - 1 &&
                  "sm:after:absolute sm:after:top-4 sm:after:left-[calc(50%+1rem)] sm:after:h-0.5 sm:after:w-[calc(100%-2rem)] sm:after:-translate-y-1/2 sm:after:content-['']",
                index < ORDER_TIMELINE_STEPS.length - 1 &&
                  (isComplete ? "sm:after:bg-trust" : "sm:after:bg-border"),
              )}
            >
              {index < ORDER_TIMELINE_STEPS.length - 1 && (
                <span
                  className={cn(
                    "absolute left-[15px] top-8 bottom-0 w-0.5 sm:hidden",
                    isComplete ? "bg-trust" : "bg-border",
                  )}
                  aria-hidden
                />
              )}

              <div
                className={cn(
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
                  isComplete && "border-trust bg-trust text-trust-foreground",
                  isCurrent &&
                    !isEscrowStep &&
                    "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                  isUpcoming && "border-border bg-muted text-muted-foreground",
                  isEscrowStep &&
                    (isCurrent || (isComplete && status === OrderStatus.in_escrow)) &&
                    "border-trust bg-trust text-trust-foreground ring-4 ring-trust/25 scale-110",
                  isEscrowStep && isComplete && status !== OrderStatus.in_escrow &&
                    "border-trust bg-trust text-trust-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </div>

              <div className="min-w-0 pt-0.5 sm:pt-3">
                <p
                  className={cn(
                    "text-sm font-semibold leading-tight",
                    isCurrent && "text-foreground",
                    isComplete && "text-foreground",
                    isUpcoming && "text-muted-foreground",
                    isEscrowStep && isCurrent && "text-trust",
                  )}
                >
                  {step.label}
                  {isEscrowStep && isCurrent && (
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-trust">
                      Active
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
