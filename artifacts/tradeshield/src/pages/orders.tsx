import { useListOrders, getListOrdersQueryKey, ListOrdersRole, OrderStatus } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Link } from "wouter";
import { OrderStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Clock, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "react-day-picker";

export default function Orders() {
  const { user } = useAuth();
  const [roleFilter, setRoleFilter] = useState<ListOrdersRole | undefined>(
    user?.role === "both" ? "buyer" : (user?.role as ListOrdersRole)
  );
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "_all">("_all");

  const { data: orders, isLoading } = useListOrders({
    role: roleFilter,
    status: statusFilter === "_all" ? undefined : statusFilter,
  }, {
    query: {
      queryKey: getListOrdersQueryKey({ role: roleFilter, status: statusFilter === "_all" ? undefined : statusFilter }),
      enabled: !!roleFilter
    }
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Orders</h1>
          <p className="text-muted-foreground mt-1">Manage your active and past trades.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {user?.role === "both" && (
          <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as ListOrdersRole)} className="w-full sm:w-auto">
            <TabsList className="grid w-full sm:w-[200px] grid-cols-2">
              <TabsTrigger value="buyer">Buying</TabsTrigger>
              <TabsTrigger value="supplier">Supplying</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "_all")}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Statuses</SelectItem>
            <SelectItem value={OrderStatus.pending_supplier_confirmation}>Pending Confirmation</SelectItem>
            <SelectItem value={OrderStatus.awaiting_payment}>Awaiting Payment</SelectItem>
            <SelectItem value={OrderStatus.in_escrow}>In Escrow</SelectItem>
            <SelectItem value={OrderStatus.shipped}>Shipped</SelectItem>
            <SelectItem value={OrderStatus.completed}>Completed</SelectItem>
            <SelectItem value={OrderStatus.disputed}>Disputed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted w-1/4 mb-4 rounded" />
                <div className="h-4 bg-muted w-1/2 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orders?.length === 0 ? (
        <div className="text-center py-24 bg-muted/10 border rounded-lg border-dashed">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No orders found</h3>
          <p className="text-muted-foreground mb-4">You don't have any orders matching these filters.</p>
          {roleFilter === "buyer" && (
            <Link href="/">
              <Button>Browse Catalog</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orders?.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="hover:shadow-md transition-shadow hover:border-primary/50 cursor-pointer">
                <CardContent className="p-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-muted-foreground">#{order.id.toString().padStart(6, '0')}</span>
                      <OrderStatusBadge status={order.status} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">₵{order.totalAmount}</span>
                      <span className="text-muted-foreground text-sm">• {order.quantity} units</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-primary group">
                    View Details <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
