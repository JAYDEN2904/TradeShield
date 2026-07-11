import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Clock, ShieldCheck, Truck } from "lucide-react";
import { OrderStatus, type OrderDetail } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/status-badge";
import { RejectOrderDialog } from "@/components/design-system/reject-order-dialog";
import { useCountdown } from "@/hooks/use-countdown";
import { formatGhs, formatOrderId } from "@/lib/format";
import { cn } from "@/lib/utils";

type SupplierActionCardProps = {
  order: OrderDetail;
  onAccept: (orderId: number) => void;
  onReject: (orderId: number, reason?: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
  activeOrderId: number | null;
};

export function SupplierActionCard({
  order,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
  activeOrderId,
}: SupplierActionCardProps) {
  const isPending = order.status === OrderStatus.pending_supplier_confirmation;
  const isEscrow = order.status === OrderStatus.in_escrow;
  const isPayoutFailed = order.status === OrderStatus.payout_failed;
  const isDisputed =
    order.status === OrderStatus.disputed ||
    order.status === OrderStatus.post_release_disputed;

  const isBusy = activeOrderId === order.id && (isAccepting || isRejecting);

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isEscrow && "border-trust/40 bg-trust-muted/10",
        isPayoutFailed && "border-destructive/30 bg-destructive/5",
        isDisputed && "border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10",
      )}
    >
      {isEscrow && <div className="h-1 w-full bg-trust" aria-hidden />}
      {isPayoutFailed && <div className="h-1 w-full bg-destructive" aria-hidden />}

      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {formatOrderId(order.id)}
          </span>
          <OrderStatusBadge status={order.status} size="md" />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="font-serif text-lg font-semibold leading-tight">
              {formatGhs(order.totalAmount)}
            </p>
            <p className="text-sm text-muted-foreground">
              {order.quantity} units ·{" "}
              {order.product ? (
                <Link
                  href={`/products/${order.productId}`}
                  className="text-primary hover:underline"
                >
                  {order.product.name}
                </Link>
              ) : (
                "Product"
              )}
            </p>
            {order.buyer && (
              <p className="text-xs text-muted-foreground truncate">
                {order.buyer.businessName}
              </p>
            )}
          </div>

          {(isEscrow || isPayoutFailed || isDisputed) && (
            <Link href={`/orders/${order.id}`}>
              <Button variant="ghost" size="sm" className="shrink-0 text-xs gap-1">
                View <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>

        {isPending && order.expiresAt && (
          <ExpiryCountdown expiresAt={String(order.expiresAt)} />
        )}

        {isEscrow && (
          <div className="flex items-center gap-2 text-sm text-trust">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Payment secured — safe to ship</span>
          </div>
        )}

        {isPayoutFailed && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Payout failed — admin notified</span>
          </div>
        )}

        {isDisputed && (
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Under admin review</span>
          </div>
        )}

        {isPending && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onAccept(order.id)}
              disabled={isBusy}
            >
              Accept
            </Button>
            <RejectOrderDialog
              onReject={(reason) => onReject(order.id, reason)}
              isRejecting={isBusy}
              triggerClassName="flex-1 text-destructive hover:text-destructive"
            />
          </div>
        )}

        {isEscrow && (
          <Link href={`/orders/${order.id}`}>
            <Button variant="trust" size="sm" className="w-full gap-2">
              <Truck className="h-3.5 w-3.5" /> Mark as shipped
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const countdown = useCountdown(expiresAt, 24 * 60 * 60 * 1000);
  if (!countdown) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      {countdown.isExpired
        ? "Confirmation window expired"
        : `Respond within ${countdown.label}`}
    </div>
  );
}
