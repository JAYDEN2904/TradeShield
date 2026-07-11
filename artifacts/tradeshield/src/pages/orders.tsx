import {
  useListOrders,
  getListOrdersQueryKey,
  ListOrdersRole,
  OrderStatus,
  type Order,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import { OrderStatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/design-system";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Clock, ArrowRight, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatGhs, formatOrderId } from "@/lib/format";
import {
  getOrderActionHint,
  isProcessingStatus,
  orderNeedsAttention,
  partitionOrders,
} from "@/lib/order-utils";
import { cn } from "@/lib/utils";

export default function Orders() {
  const { user, activeRole } = useAuth();
  const [roleFilter, setRoleFilter] = useState<ListOrdersRole | undefined>(() => {
    if (!user) return undefined;
    if (user.role === "both") return activeRole;
    return user.role as ListOrdersRole;
  });
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "_all">("_all");

  useEffect(() => {
    if (!user) return;
    if (user.role === "both") {
      setRoleFilter(activeRole);
    }
  }, [user?.id, user?.role, activeRole]);

  const { data: orders, isLoading } = useListOrders(
    {
      role: roleFilter,
      status: statusFilter === "_all" ? undefined : statusFilter,
    },
    {
      query: {
        queryKey: getListOrdersQueryKey({
          role: roleFilter,
          status: statusFilter === "_all" ? undefined : statusFilter,
        }),
        enabled: !!roleFilter && !!user,
        refetchInterval: (query) => {
          const data = query.state.data;
          if (data?.some((o) => isProcessingStatus(o.status))) return 3000;
          return false;
        },
      },
    },
  );

  const { attention, rest } = useMemo(() => {
    if (!orders || !user) return { attention: [], rest: [] };
    if (statusFilter !== "_all") {
      return { attention: orders, rest: [] as Order[] };
    }
    return partitionOrders(orders, user.id);
  }, [orders, user, statusFilter]);

  return (
    <div className="ts-container py-8 md:py-10 max-w-5xl">
      <PageHeader
        title="Your orders"
        description="Track escrow status and manage active trades."
        className="mb-8"
      />

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {user?.role === "both" && (
          <Tabs
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v as ListOrdersRole)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full sm:w-[200px] grid-cols-2">
              <TabsTrigger value="buyer">Buying</TabsTrigger>
              <TabsTrigger value="supplier">Supplying</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as OrderStatus | "_all")}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            <SelectItem value={OrderStatus.pending_supplier_confirmation}>
              Pending confirmation
            </SelectItem>
            <SelectItem value={OrderStatus.awaiting_payment}>Awaiting payment</SelectItem>
            <SelectItem value={OrderStatus.payment_processing}>Processing</SelectItem>
            <SelectItem value={OrderStatus.in_escrow}>In escrow</SelectItem>
            <SelectItem value={OrderStatus.shipped}>Shipped</SelectItem>
            <SelectItem value={OrderStatus.payout_processing}>Releasing payment</SelectItem>
            <SelectItem value={OrderStatus.completed}>Completed</SelectItem>
            <SelectItem value={OrderStatus.disputed}>Disputed</SelectItem>
            <SelectItem value={OrderStatus.post_release_disputed}>
              Post-release dispute
            </SelectItem>
            <SelectItem value={OrderStatus.rejected}>Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <OrderListSkeleton />
      ) : orders?.length === 0 ? (
        <EmptyOrders roleFilter={roleFilter} />
      ) : (
        <div className="space-y-8">
          {statusFilter === "_all" && attention.length > 0 && (
            <section>
              <SectionHeader
                icon={Zap}
                title="Needs your attention"
                count={attention.length}
              />
              <div className="space-y-3 mt-4">
                {attention.map((order) => (
                  <OrderRow key={order.id} order={order} userId={user!.id} highlight />
                ))}
              </div>
            </section>
          )}

          {(statusFilter !== "_all" ? attention : rest).length > 0 && (
            <section>
              {statusFilter === "_all" && rest.length > 0 && (
                <SectionHeader title="All orders" count={rest.length} />
              )}
              <div className="space-y-3 mt-4">
                {(statusFilter !== "_all" ? attention : rest).map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    userId={user!.id}
                    highlight={statusFilter !== "_all"}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  icon: Icon,
}: {
  title: string;
  count: number;
  icon?: typeof Zap;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-cta" />}
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

function OrderRow({
  order,
  userId,
  highlight = false,
}: {
  order: Order;
  userId: number;
  highlight?: boolean;
}) {
  const hint = getOrderActionHint(order, userId);
  const isEscrow = order.status === OrderStatus.in_escrow;
  const needsYou = orderNeedsAttention(order, userId);

  return (
    <Link href={`/orders/${order.id}`}>
      <Card
        className={cn(
          "ts-card-interactive cursor-pointer overflow-hidden",
          highlight && needsYou && "ring-1 ring-primary/20",
          isEscrow && "border-trust/40 bg-trust-muted/20",
        )}
      >
        {isEscrow && (
          <div className="h-1 w-full bg-trust" aria-hidden />
        )}
        <CardContent className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {formatOrderId(order.id)}
              </span>
              <OrderStatusBadge
                status={order.status}
                size={isEscrow ? "lg" : "md"}
              />
              {needsYou && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-cta">
                  Action needed
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap min-w-0">
              {order.productName && (
                <span className="font-semibold text-base truncate max-w-full">
                  {order.productName}
                </span>
              )}
              <span className="font-serif text-xl font-semibold shrink-0">
                {formatGhs(order.totalAmount)}
              </span>
              <span className="text-muted-foreground text-sm shrink-0">
                {order.quantity} units
              </span>
            </div>
            {hint && (
              <p className="text-sm text-muted-foreground line-clamp-1">{hint}</p>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(order.createdAt).toLocaleDateString("en-GH")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary shrink-0">
            View details
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function OrderListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-6 bg-muted w-1/4 mb-4 rounded" />
            <div className="h-4 bg-muted w-1/2 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyOrders({ roleFilter }: { roleFilter?: ListOrdersRole }) {
  return (
    <div className="text-center py-24 bg-card border border-dashed rounded-xl">
      <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="text-lg font-serif font-semibold mb-2">No orders found</h3>
      <p className="text-muted-foreground text-sm mb-6">
        No orders match your current filters.
      </p>
      {roleFilter === "buyer" && (
        <Link href="/">
          <Button variant="cta">Browse catalog</Button>
        </Link>
      )}
    </div>
  );
}
