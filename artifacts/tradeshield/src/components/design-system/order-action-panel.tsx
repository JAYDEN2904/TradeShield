import { ReactNode, useState } from "react";
import {
  OrderStatus,
  type OrderDetail,
} from "@workspace/api-client-react";
import { formatGhs } from "@/lib/format";
import { getOrderStatusConfig } from "@/lib/order-status-config";
import { AutoReleaseCountdown } from "./auto-release-countdown";
import { ProcessingBanner } from "./processing-banner";
import { RejectOrderDialog } from "./reject-order-dialog";
import { useCountdown } from "@/hooks/use-countdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, Star, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type OrderActionPanelProps = {
  order: OrderDetail;
  isBuyer: boolean;
  isSupplier: boolean;
  disputeReason: string;
  onDisputeReasonChange: (value: string) => void;
  isDisputeOpen: boolean;
  onDisputeOpenChange: (open: boolean) => void;
  isRatingOpen: boolean;
  onRatingOpenChange: (open: boolean) => void;
  ratingStars: number;
  onRatingStarsChange: (stars: number) => void;
  ratingComment: string;
  onRatingCommentChange: (value: string) => void;
  onAccept: () => void;
  onReject: (reason?: string) => void;
  onPay: () => void;
  onShip: () => void;
  onConfirm: () => void;
  onDispute: () => void;
  onRate: () => void;
  isAccepting: boolean;
  isRejecting: boolean;
  isPaying: boolean;
  isShipping: boolean;
  isConfirming: boolean;
  isDisputing: boolean;
  isRating: boolean;
  className?: string;
};

export function OrderActionPanel({
  order,
  isBuyer,
  isSupplier,
  disputeReason,
  onDisputeReasonChange,
  isDisputeOpen,
  onDisputeOpenChange,
  isRatingOpen,
  onRatingOpenChange,
  ratingStars,
  onRatingStarsChange,
  ratingComment,
  onRatingCommentChange,
  onAccept,
  onReject,
  onPay,
  onShip,
  onConfirm,
  onDispute,
  onRate,
  isAccepting,
  isRejecting,
  isPaying,
  isShipping,
  isConfirming,
  isDisputing,
  isRating,
  className,
}: OrderActionPanelProps) {
  const statusConfig = getOrderStatusConfig(order.status);
  const hasActions =
    (isSupplier && order.status === OrderStatus.pending_supplier_confirmation) ||
    (isBuyer && order.status === OrderStatus.awaiting_payment) ||
    (isSupplier && order.status === OrderStatus.in_escrow) ||
    (isBuyer && order.status === OrderStatus.shipped) ||
    order.status === OrderStatus.completed;

  return (
    <Card className={cn("md:sticky md:top-24", className)}>
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base font-sans font-semibold">Next steps</CardTitle>
        <p className="text-sm text-muted-foreground font-sans font-normal mt-1 leading-relaxed">
          {statusConfig.description}
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {order.status === OrderStatus.pending_supplier_confirmation &&
          order.expiresAt &&
          isSupplier && (
            <PendingExpiryCountdown expiresAt={order.expiresAt} />
          )}

        {order.status === OrderStatus.payment_processing && (
          <ProcessingBanner
            variant="payment"
            title="Complete payment on your phone"
            description={`Approve the mobile money prompt to move ${formatGhs(order.totalAmount)} into escrow.`}
          />
        )}

        {order.status === OrderStatus.payout_processing && (
          <ProcessingBanner
            variant="payout"
            title="Releasing payment to supplier"
            description="Funds are being disbursed. You'll see confirmation shortly."
          />
        )}

        {isSupplier && order.status === OrderStatus.in_escrow && (
          <div className="rounded-lg border border-trust/30 bg-trust-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">
              {formatGhs(order.totalAmount)} secured
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Safe to ship — buyer payment is in escrow.
            </p>
          </div>
        )}

        {isSupplier && order.status === OrderStatus.pending_supplier_confirmation && (
          <ActionGroup>
            <Button className="w-full" onClick={onAccept} disabled={isAccepting}>
              Accept order
            </Button>
            <RejectOrderDialog onReject={onReject} isRejecting={isRejecting} />
          </ActionGroup>
        )}

        {isBuyer && order.status === OrderStatus.awaiting_payment && (
          <ActionGroup>
            <Button
              variant="cta"
              size="lg"
              className="w-full"
              onClick={onPay}
              disabled={isPaying}
            >
              Pay {formatGhs(order.totalAmount)} to escrow
            </Button>
          </ActionGroup>
        )}

        {isSupplier && order.status === OrderStatus.in_escrow && (
          <Button
            variant="trust"
            size="lg"
            className="w-full"
            onClick={onShip}
            disabled={isShipping}
          >
            <Truck className="mr-2 h-4 w-4" /> Mark as shipped
          </Button>
        )}

        {isBuyer && order.status === OrderStatus.shipped && (
          <ActionGroup>
            {order.autoReleaseAt && (
              <AutoReleaseCountdown autoReleaseAt={order.autoReleaseAt} />
            )}
            <Button
              variant="trust"
              size="lg"
              className="w-full"
              onClick={onConfirm}
              disabled={isConfirming}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm receipt
            </Button>
            <DisputeDialog
              open={isDisputeOpen}
              onOpenChange={onDisputeOpenChange}
              reason={disputeReason}
              onReasonChange={onDisputeReasonChange}
              onSubmit={onDispute}
              isSubmitting={isDisputing}
            />
          </ActionGroup>
        )}

        {isSupplier && order.status === OrderStatus.shipped && (
          <ActionGroup>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              Waiting for buyer confirmation. Auto-release applies after 72 hours.
            </div>
            <DisputeDialog
              open={isDisputeOpen}
              onOpenChange={onDisputeOpenChange}
              reason={disputeReason}
              onReasonChange={onDisputeReasonChange}
              onSubmit={onDispute}
              isSubmitting={isDisputing}
              triggerLabel="Report an issue"
              description="Flag a problem if the buyer has not received goods or is disputing unfairly."
            />
          </ActionGroup>
        )}

        {!hasActions &&
          order.status !== OrderStatus.payment_processing &&
          order.status !== OrderStatus.payout_processing && (
            <WaitingState
              message={getWaitingMessage(order.status, isBuyer, isSupplier)}
            />
          )}

        {order.status === OrderStatus.completed && (
          <CompletedState
            isBuyer={isBuyer}
            supplierName={order.supplier?.businessName}
            isRatingOpen={isRatingOpen}
            onRatingOpenChange={onRatingOpenChange}
            ratingStars={ratingStars}
            onRatingStarsChange={onRatingStarsChange}
            ratingComment={ratingComment}
            onRatingCommentChange={onRatingCommentChange}
            onRate={onRate}
            isRating={isRating}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PendingExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const countdown = useCountdown(expiresAt, 24 * 60 * 60 * 1000);
  if (!countdown) return null;

  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm">
      <p className="font-medium text-foreground">
        {countdown.isExpired ? "Response window expired" : `Respond within ${countdown.label}`}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Unconfirmed orders auto-expire after 24 hours.
      </p>
    </div>
  );
}

function ActionGroup({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function WaitingState({
  message,
  spinning = false,
}: {
  message: string;
  spinning?: boolean;
}) {
  return (
    <div className="text-sm text-center text-muted-foreground py-6 flex flex-col items-center gap-3">
      <Clock
        className={cn(
          "h-9 w-9 text-muted-foreground/35",
          spinning && "animate-spin",
        )}
      />
      <p className="max-w-[220px] leading-relaxed">{message}</p>
    </div>
  );
}

function getWaitingMessage(
  status: OrderDetail["status"],
  isBuyer: boolean,
  isSupplier: boolean,
): string {
  switch (status) {
    case OrderStatus.pending_supplier_confirmation:
      return isBuyer
        ? "Waiting for supplier to confirm availability."
        : "Review and accept or reject this order.";
    case OrderStatus.awaiting_payment:
      return isSupplier
        ? "Waiting for buyer to complete escrow payment."
        : "Complete payment when ready.";
    case OrderStatus.shipped:
      return isSupplier
        ? "Waiting for buyer to confirm receipt."
        : "Confirm when goods arrive.";
    case OrderStatus.disputed:
    case OrderStatus.post_release_disputed:
      return "This order is under admin review.";
    case OrderStatus.rejected:
      return "Supplier rejected this order.";
    case OrderStatus.payout_failed:
      return "Payout could not complete. Admin has been notified.";
    case OrderStatus.expired:
      return "This order was closed.";
    default:
      return "No action required right now.";
  }
}

function DisputeDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  isSubmitting,
  triggerLabel = "Raise dispute",
  description = "Payment will be frozen and an admin will review both sides.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  triggerLabel?: string;
  description?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full text-destructive">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{triggerLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <Textarea
            placeholder="Describe the issue in detail..."
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={!reason.trim() || isSubmitting}
          >
            Submit dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompletedState({
  isBuyer,
  supplierName,
  isRatingOpen,
  onRatingOpenChange,
  ratingStars,
  onRatingStarsChange,
  ratingComment,
  onRatingCommentChange,
  onRate,
  isRating,
}: {
  isBuyer: boolean;
  supplierName?: string;
  isRatingOpen: boolean;
  onRatingOpenChange: (open: boolean) => void;
  ratingStars: number;
  onRatingStarsChange: (stars: number) => void;
  ratingComment: string;
  onRatingCommentChange: (value: string) => void;
  onRate: () => void;
  isRating: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-trust/30 bg-trust-muted/50 p-5 text-center">
        <CheckCircle2 className="h-9 w-9 text-trust mx-auto mb-2" />
        <p className="font-serif text-lg font-semibold">Trade complete</p>
        <p className="text-xs text-muted-foreground mt-1">
          Payment released to supplier.
        </p>
      </div>

      {isBuyer && (
        <Dialog open={isRatingOpen} onOpenChange={onRatingOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Star className="mr-2 h-4 w-4" /> Rate supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rate this trade</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                How was your experience with {supplierName}?
              </p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-8 w-8 cursor-pointer transition-colors duration-150",
                      star <= ratingStars ? "fill-cta text-cta" : "text-muted",
                    )}
                    onClick={() => onRatingStarsChange(star)}
                  />
                ))}
              </div>
              <Textarea
                placeholder="Add a comment (optional)..."
                value={ratingComment}
                onChange={(e) => onRatingCommentChange(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onRatingOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onRate} disabled={isRating}>
                Submit rating
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
