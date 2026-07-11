import { useState } from "react";
import { Link } from "wouter";
import {
  useAcceptOrder,
  useRejectOrder,
  getGetSupplierDashboardQueryKey,
  useGetSupplierDashboard,
  GetSupplierDashboardEarningsPeriod,
  type SupplierDashboard,
  OrderStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Package,
  ShieldCheck,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/status-badge";
import { SupplierTrustBadge } from "@/components/design-system";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { formatGhs, formatOrderId } from "@/lib/format";
import { formatCompletionRate } from "@/lib/supplier-trust";
import { isProcessingStatus } from "@/lib/order-utils";
import { SupplierActionCard } from "./supplier-action-card";
import { SupplierOnboarding } from "./supplier-onboarding";
import { EarningsPeriodToggle, type EarningsPeriod } from "./earnings-period-toggle";

export function SupplierOverview({
  onSwitchToProducts,
}: {
  onSwitchToProducts: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<EarningsPeriod>(
    GetSupplierDashboardEarningsPeriod.month,
  );
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  const params = { earningsPeriod: period };
  const queryKey = getGetSupplierDashboardQueryKey(params);

  const { data, isLoading } = useGetSupplierDashboard(params, {
    query: {
      queryKey,
      enabled: !!user,
      refetchInterval: (query) => {
        const d = query.state.data as SupplierDashboard | undefined;
        if (
          d?.needsAction?.some((o) => isProcessingStatus(o.status)) ||
          d?.recentOrders?.some((o) => isProcessingStatus(o.status))
        ) {
          return 3000;
        }
        return false;
      },
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["/orders"] });
  };

  const onError = (err: unknown) =>
    toast({
      title: "Error",
      description: getErrorMessage(err, "Action failed"),
      variant: "destructive",
    });

  const acceptMut = useAcceptOrder({
    mutation: {
      onSuccess: () => {
        invalidate();
        setActiveOrderId(null);
        toast({ title: "Order accepted — buyer can now pay." });
      },
      onError,
    },
  });

  const rejectMut = useRejectOrder({
    mutation: {
      onSuccess: () => {
        invalidate();
        setActiveOrderId(null);
        toast({ title: "Order rejected." });
      },
      onError,
    },
  });

  const handleAccept = (orderId: number) => {
    setActiveOrderId(orderId);
    acceptMut.mutate({ id: orderId });
  };

  const handleReject = (orderId: number, reason?: string) => {
    setActiveOrderId(orderId);
    rejectMut.mutate({ id: orderId, data: reason ? { reason } : undefined });
  };

  if (isLoading || !data) {
    return <OverviewSkeleton />;
  }

  const hasActionItems = data.needsAction.length > 0;

  return (
    <div className="space-y-8">
      {/* Onboarding */}
      <SupplierOnboarding
        onboarding={data.onboarding}
        onAddProduct={onSwitchToProducts}
      />

      {/* Action required */}
      {hasActionItems && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-cta" />
            <h2 className="font-serif text-lg font-semibold">Needs your attention</h2>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {data.needsAction.length}
            </span>
          </div>
          <div className="space-y-3">
            {data.needsAction.map((order) => (
              <SupplierActionCard
                key={order.id}
                order={order}
                onAccept={handleAccept}
                onReject={handleReject}
                isAccepting={acceptMut.isPending}
                isRejecting={rejectMut.isPending}
                activeOrderId={activeOrderId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Money at a glance */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="font-serif text-lg font-semibold">Money at a glance</h2>
          <EarningsPeriodToggle value={period} onChange={setPeriod} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <EarningsCard
            label={`Earned (${periodLabel(period)})`}
            value={formatGhs(data.earnings.earnedGhs)}
            sublabel="after fees"
            icon={TrendingUp}
          />
          <EarningsCard
            label="In escrow"
            value={formatGhs(data.earnings.inEscrowGhs)}
            sublabel="Secured, awaiting delivery"
            icon={ShieldCheck}
            variant="trust"
          />
          <EarningsCard
            label="Pending release"
            value={formatGhs(data.earnings.pendingReleaseGhs)}
            sublabel="Being disbursed"
            icon={Clock}
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </section>

      {/* Catalog health */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold">Catalog health</h2>
          <Button variant="outline" size="sm" onClick={onSwitchToProducts}>
            Manage products
          </Button>
        </div>
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-6">
            <CatalogStat
              label="Active"
              value={data.catalog.activeCount}
              icon={Package}
            />
            <CatalogStat
              label="Out of stock"
              value={data.catalog.outOfStockCount}
              icon={AlertTriangle}
              variant={data.catalog.outOfStockCount > 0 ? "warn" : "default"}
            />
            <CatalogStat
              label="Low stock"
              value={data.catalog.lowStockCount}
              icon={AlertTriangle}
              variant={data.catalog.lowStockCount > 0 ? "warn" : "default"}
            />
            <CatalogStat
              label="Inactive"
              value={data.catalog.inactiveCount}
              icon={Package}
            />
          </CardContent>
        </Card>
      </section>

      {/* Recent orders */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold">Recent orders</h2>
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No orders yet. Once buyers place orders, they'll appear here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.recentOrders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="ts-card-interactive cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatOrderId(order.id)}
                        </span>
                        <OrderStatusBadge status={order.status} size="md" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-semibold">
                          {formatGhs(order.totalAmount)}
                        </span>
                        {order.buyer && (
                          <span className="text-xs text-muted-foreground truncate">
                            · {order.buyer.businessName}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trust & reputation */}
      {data.trust && (
        <section>
          <h2 className="font-serif text-lg font-semibold mb-4">
            Trust &amp; reputation
          </h2>
          <Card className="border-trust/20 bg-trust-muted/10">
            <CardContent className="p-5 space-y-4">
              <SupplierTrustBadge stats={data.trust} />
              <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
                {formatCompletionRate(data.trust)}
              </p>
              {user && (
                <Link href={`/suppliers/${user.id}`}>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto gap-1">
                    <Star className="h-3.5 w-3.5" /> View your public storefront
                  </Button>
                </Link>
              )}
              {data.trust.isNewSupplier && (
                <p className="text-xs text-muted-foreground">
                  Complete{" "}
                  {5 - data.trust.completedOrders > 0
                    ? 5 - data.trust.completedOrders
                    : 0}{" "}
                  more order{5 - data.trust.completedOrders === 1 ? "" : "s"} to
                  unlock Established status.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function periodLabel(period: EarningsPeriod): string {
  switch (period) {
    case "week":
      return "this week";
    case "month":
      return "this month";
    case "all":
      return "all time";
    default: {
      const _exhaustive: never = period;
      return _exhaustive;
    }
  }
}

function EarningsCard({
  label,
  value,
  sublabel,
  icon: Icon,
  variant,
  className,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: typeof TrendingUp;
  variant?: "trust";
  className?: string;
}) {
  return (
    <Card
      className={`${variant === "trust" ? "border-trust/30 bg-trust-muted/20" : ""} ${className ?? ""}`}
    >
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon
            className={`h-3.5 w-3.5 ${variant === "trust" ? "text-trust" : ""}`}
          />
          {label}
        </div>
        <p className="font-serif text-xl font-bold leading-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

function CatalogStat({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: number;
  icon: typeof Package;
  variant?: "default" | "warn";
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        className={`h-4 w-4 ${variant === "warn" && value > 0 ? "text-amber-500" : "text-muted-foreground"}`}
      />
      <div>
        <p className="text-lg font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
