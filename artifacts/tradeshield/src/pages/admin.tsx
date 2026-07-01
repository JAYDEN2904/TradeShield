import { useState } from "react";
import { Link } from "wouter";
import { useListAllOrders, getListAllOrdersQueryKey, useListDisputes, getListDisputesQueryKey, useResolveDispute, OrderStatus, DisputeStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { OrderStatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [orderStatus, setOrderStatus] = useState<OrderStatus | "_all">("_all");
  const [disputeStatus, setDisputeStatus] = useState<DisputeStatus | "_all">(DisputeStatus.open);
  
  const { data: orders, isLoading: ordersLoading } = useListAllOrders(
    { status: orderStatus === "_all" ? undefined : orderStatus },
    { query: { queryKey: getListAllOrdersQueryKey({ status: orderStatus === "_all" ? undefined : orderStatus }) } }
  );
  
  const { data: disputes, isLoading: disputesLoading } = useListDisputes(
    { status: disputeStatus === "_all" ? undefined : disputeStatus },
    { query: { queryKey: getListDisputesQueryKey({ status: disputeStatus === "_all" ? undefined : disputeStatus }) } }
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
          <ShieldAlert className="h-8 w-8" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Manage platform operations and resolve disputes.</p>
      </div>

      <Tabs defaultValue="disputes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="disputes">
            Disputes
            {disputes?.filter(d => d.status === DisputeStatus.open).length ? (
              <Badge variant="destructive" className="ml-2 rounded-full px-2 py-0.5 text-xs">
                {disputes.filter(d => d.status === DisputeStatus.open).length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="orders">All Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="disputes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Platform Disputes</h2>
            <Select value={disputeStatus} onValueChange={(v) => setDisputeStatus(v as DisputeStatus | "_all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Disputes</SelectItem>
                <SelectItem value={DisputeStatus.open}>Open</SelectItem>
                <SelectItem value={DisputeStatus.resolved}>Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputesLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : disputes?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No disputes found.</TableCell></TableRow>
                ) : (
                  disputes?.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-mono">#{dispute.orderId.toString().padStart(6, '0')}</TableCell>
                      <TableCell>
                        <Badge variant={dispute.status === DisputeStatus.open ? "destructive" : "secondary"}>
                          {dispute.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate" title={dispute.reason}>{dispute.reason}</TableCell>
                      <TableCell>{new Date(dispute.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link href={`/orders/${dispute.orderId}`}>
                          <Button variant="ghost" size="sm">View Order</Button>
                        </Link>
                        {dispute.status === DisputeStatus.open && (
                          <ResolveDisputeDialog disputeId={dispute.id} orderId={dispute.orderId} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Global Orders</h2>
            <Select value={orderStatus} onValueChange={(v) => setOrderStatus(v as OrderStatus | "_all")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Order Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Statuses</SelectItem>
                {Object.values(OrderStatus).map(status => (
                  <SelectItem key={status} value={status}>{status.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : orders?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders found.</TableCell></TableRow>
                ) : (
                  orders?.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">#{order.id.toString().padStart(6, '0')}</TableCell>
                      <TableCell className="font-medium">{order.product?.name}</TableCell>
                      <TableCell>{order.buyer?.businessName}</TableCell>
                      <TableCell>{order.supplier?.businessName}</TableCell>
                      <TableCell>₵{order.totalAmount}</TableCell>
                      <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                      <TableCell className="text-right">
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResolveDisputeDialog({ disputeId, orderId }: { disputeId: number, orderId: number }) {
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<OrderStatus>(OrderStatus.completed);
  const [resolution, setResolution] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resolveMut = useResolveDispute({
    mutation: {
      onSuccess: () => {
        toast({ title: "Dispute Resolved" });
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: getListDisputesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAllOrdersQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to resolve dispute", variant: "destructive" });
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive border-destructive">Resolve</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Dispute</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Order Status</label>
            <Select value={targetStatus} onValueChange={(v) => setTargetStatus(v as OrderStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OrderStatus.completed}>Completed (Release Funds)</SelectItem>
                <SelectItem value={OrderStatus.expired}>Expired (Cancel/Refund)</SelectItem>
                <SelectItem value={OrderStatus.payout_failed}>Payout Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Resolution Notes</label>
            <Textarea 
              placeholder="Explain the resolution decision..." 
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            variant="destructive"
            onClick={() => resolveMut.mutate({ data: { targetStatus, resolution } })}
            disabled={!resolution.trim() || resolveMut.isPending}
          >
            Force Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
