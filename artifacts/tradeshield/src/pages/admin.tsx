import { useState } from "react";
import { Link } from "wouter";
import {
  useGetAdminMetrics,
  getGetAdminMetricsQueryKey,
  useListAllOrders,
  getListAllOrdersQueryKey,
  useListDisputes,
  getListDisputesQueryKey,
  useResolveDispute,
  useAdminReleaseOrderFunds,
  useAdminRefundOrder,
  useAdminRetryPayout,
  useAdminExpireOrder,
  useGetAdminKycQueue,
  getGetAdminKycQueueQueryKey,
  useGetAdminKycUsers,
  getGetAdminKycUsersQueryKey,
  useApproveKyc,
  useRejectKyc,
  OrderStatus,
  DisputeStatus,
  type KycStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  Users,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Ban,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { OrderStatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/design-system";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { formatGhs } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export default function Admin() {
  const [orderStatus, setOrderStatus] = useState<OrderStatus | "_all">("_all");
  const [disputeStatus, setDisputeStatus] = useState<DisputeStatus | "_all">(
    DisputeStatus.open,
  );
  const [kycRecordsStatus, setKycRecordsStatus] = useState<KycStatus | "_all">("_all");

  const { data: metrics, isLoading: metricsLoading } = useGetAdminMetrics({
    query: { queryKey: getGetAdminMetricsQueryKey() },
  });

  const { data: orders, isLoading: ordersLoading } = useListAllOrders(
    { status: orderStatus === "_all" ? undefined : orderStatus },
    {
      query: {
        queryKey: getListAllOrdersQueryKey({
          status: orderStatus === "_all" ? undefined : orderStatus,
        }),
      },
    },
  );

  const { data: disputes, isLoading: disputesLoading } = useListDisputes(
    { status: disputeStatus === "_all" ? undefined : disputeStatus },
    {
      query: {
        queryKey: getListDisputesQueryKey({
          status: disputeStatus === "_all" ? undefined : disputeStatus,
        }),
      },
    },
  );

  const openDisputeCount =
    disputes?.filter((d) => d.status === DisputeStatus.open).length ?? 0;

  const { data: kycQueue, isLoading: kycLoading } = useGetAdminKycQueue({
    query: { queryKey: getGetAdminKycQueueQueryKey() },
  });

  const kycUsersParams =
    kycRecordsStatus === "_all" ? undefined : { status: kycRecordsStatus };

  const { data: kycRecords, isLoading: kycRecordsLoading } = useGetAdminKycUsers(
    kycUsersParams,
    {
      query: { queryKey: getGetAdminKycUsersQueryKey(kycUsersParams) },
    },
  );

  return (
    <div className="ts-container py-8 md:py-10 max-w-6xl">
      <PageHeader
        eyebrow="Operations"
        title="Admin dashboard"
        description="Platform visibility, manual overrides, and dispute resolution."
        className="mb-8"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Transaction volume"
          value={metricsLoading ? undefined : formatGhs(metrics?.totalVolumeGhs ?? "0")}
          icon={Banknote}
          loading={metricsLoading}
        />
        <MetricCard
          label="Platform fees earned"
          value={metricsLoading ? undefined : formatGhs(metrics?.totalPlatformFeesGhs ?? "0")}
          icon={TrendingUp}
          loading={metricsLoading}
        />
        <MetricCard
          label="Active users"
          value={
            metricsLoading
              ? undefined
              : `${metrics?.activeBuyers ?? 0} buyers · ${metrics?.activeSuppliers ?? 0} suppliers`
          }
          icon={Users}
          loading={metricsLoading}
        />
        <MetricCard
          label="Completion rate"
          value={
            metricsLoading
              ? undefined
              : `${Math.round((metrics?.completionRate ?? 0) * 100)}% (${metrics?.completedOrders ?? 0}/${metrics?.totalOrders ?? 0})`
          }
          icon={ShieldCheck}
          loading={metricsLoading}
          sub={
            !metricsLoading && (metrics?.openDisputes ?? 0) > 0
              ? `${metrics?.openDisputes} open disputes`
              : undefined
          }
        />
      </div>

      <Tabs defaultValue="disputes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="disputes">
            Disputes
            {openDisputeCount > 0 ? (
              <Badge variant="destructive" className="ml-2 rounded-full px-2 py-0.5 text-xs">
                {openDisputeCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="orders">All orders</TabsTrigger>
          <TabsTrigger value="kyc-queue">
            KYC Queue
            {(kycQueue?.length ?? 0) > 0 ? (
              <Badge variant="secondary" className="ml-2 rounded-full px-2 py-0.5 text-xs">
                {kycQueue!.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="kyc-records">KYC Records</TabsTrigger>
        </TabsList>

        <TabsContent value="disputes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Platform disputes</h2>
            <Select
              value={disputeStatus}
              onValueChange={(v) => setDisputeStatus(v as DisputeStatus | "_all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All disputes</SelectItem>
                <SelectItem value={DisputeStatus.open}>Open</SelectItem>
                <SelectItem value={DisputeStatus.resolved}>Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputesLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : disputes?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No disputes found.
                    </TableCell>
                  </TableRow>
                ) : (
                  disputes?.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-mono">
                        #{dispute.orderId.toString().padStart(6, "0")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            dispute.status === DisputeStatus.open
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {dispute.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate" title={dispute.reason}>
                        {dispute.reason}
                      </TableCell>
                      <TableCell>
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link href={`/orders/${dispute.orderId}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                        {dispute.status === DisputeStatus.open && (
                          <ResolveDisputeDialog disputeId={dispute.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Global orders</h2>
            <Select
              value={orderStatus}
              onValueChange={(v) => setOrderStatus(v as OrderStatus | "_all")}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Order status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All statuses</SelectItem>
                {Object.values(OrderStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : orders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders?.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">
                        #{order.id.toString().padStart(6, "0")}
                      </TableCell>
                      <TableCell className="font-medium">{order.product?.name}</TableCell>
                      <TableCell>{order.buyer?.businessName}</TableCell>
                      <TableCell>{order.supplier?.businessName}</TableCell>
                      <TableCell>{formatGhs(order.totalAmount)}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <AdminOrderActions orderId={order.id} status={order.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="kyc-queue" className="space-y-4">
          <h2 className="text-xl font-semibold">KYC Queue</h2>
          {kycLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
            </div>
          ) : !kycQueue || kycQueue.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No pending verifications.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {kycQueue.map((item) => (
                <KycQueueCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kyc-records" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">KYC Records</h2>
            <Select
              value={kycRecordsStatus}
              onValueChange={(v) => setKycRecordsStatus(v as KycStatus | "_all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All statuses</SelectItem>
                <SelectItem value="none">Not submitted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Ghana Card</TableHead>
                  <TableHead className="text-right">Documents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kycRecordsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : !kycRecords || kycRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  kycRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.businessName}</TableCell>
                      <TableCell>{record.phone}</TableCell>
                      <TableCell className="capitalize">{record.role}</TableCell>
                      <TableCell>
                        <KycStatusBadge status={record.kycStatus} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatKycDate(record.kycSubmittedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatKycDate(record.kycReviewedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {record.ghanaCardNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {record.documents.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            record.documents.map((doc) => (
                              <a
                                key={doc.docType}
                                href={doc.storageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {doc.docType === "ghana_card_front" ? "Front" : "Back"}
                              </a>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  loading,
  sub,
}: {
  label: string;
  value?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className="text-2xl font-serif font-semibold">{value}</p>
            {sub && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {sub}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AdminOrderActions({
  orderId,
  status,
}: {
  orderId: number;
  status: OrderStatus;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAllOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminMetricsQueryKey() });
  };

  const onError = (err: unknown) => {
    toast({
      title: "Action failed",
      description: getErrorMessage(err, "Could not complete admin action"),
      variant: "destructive",
    });
  };

  const releaseMut = useAdminReleaseOrderFunds({
    mutation: {
      onSuccess: () => {
        toast({ title: "Payout initiated" });
        invalidate();
      },
      onError,
    },
  });

  const refundMut = useAdminRefundOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Refund initiated" });
        invalidate();
      },
      onError,
    },
  });

  const retryMut = useAdminRetryPayout({
    mutation: {
      onSuccess: () => {
        toast({ title: "Payout retry initiated" });
        invalidate();
      },
      onError,
    },
  });

  const expireMut = useAdminExpireOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order expired" });
        invalidate();
      },
      onError,
    },
  });

  const releaseStatuses: OrderStatus[] = [
    OrderStatus.in_escrow,
    OrderStatus.shipped,
    OrderStatus.payout_failed,
  ];
  const refundStatuses: OrderStatus[] = [
    OrderStatus.awaiting_payment,
    OrderStatus.in_escrow,
    OrderStatus.shipped,
    OrderStatus.disputed,
    OrderStatus.post_release_disputed,
  ];
  const terminalStatuses: OrderStatus[] = [
    OrderStatus.completed,
    OrderStatus.expired,
    OrderStatus.rejected,
    OrderStatus.disputed,
    OrderStatus.post_release_disputed,
  ];

  const canRelease = releaseStatuses.includes(status);
  const canRefund = refundStatuses.includes(status);
  const canRetry = status === OrderStatus.payout_failed;
  const canExpire = !terminalStatuses.includes(status);

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/orders/${orderId}`}>
        <Button variant="ghost" size="icon" aria-label="View order">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      {canRelease && (
        <Button
          variant="outline"
          size="icon"
          title="Release funds"
          disabled={releaseMut.isPending}
          onClick={() => releaseMut.mutate({ id: orderId })}
        >
          <ShieldCheck className="h-4 w-4 text-trust" />
        </Button>
      )}
      {canRefund && (
        <Button
          variant="outline"
          size="icon"
          title="Refund buyer"
          disabled={refundMut.isPending}
          onClick={() => refundMut.mutate({ id: orderId })}
        >
          <Banknote className="h-4 w-4" />
        </Button>
      )}
      {canRetry && (
        <Button
          variant="outline"
          size="icon"
          title="Retry payout"
          disabled={retryMut.isPending}
          onClick={() => retryMut.mutate({ id: orderId })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      {canExpire && (
        <Button
          variant="outline"
          size="icon"
          title="Expire order"
          disabled={expireMut.isPending}
          onClick={() => expireMut.mutate({ id: orderId })}
        >
          <Ban className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}

function ResolveDisputeDialog({ disputeId }: { disputeId: number }) {
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<OrderStatus>(
    OrderStatus.payout_processing,
  );
  const [resolution, setResolution] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resolveMut = useResolveDispute({
    mutation: {
      onSuccess: () => {
        toast({ title: "Dispute resolved" });
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: getListDisputesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAllOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminMetricsQueryKey() });
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: getErrorMessage(err, "Failed to resolve dispute"),
          variant: "destructive",
        });
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive border-destructive">
          Resolve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve dispute</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Resolution outcome</label>
            <Select
              value={targetStatus}
              onValueChange={(v) => setTargetStatus(v as OrderStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OrderStatus.payout_processing}>
                  Release funds to supplier
                </SelectItem>
                <SelectItem value={OrderStatus.expired}>
                  Refund buyer & close order
                </SelectItem>
                <SelectItem value={OrderStatus.payout_failed}>
                  Flag payout failed (manual follow-up)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Resolution notes</label>
            <Textarea
              placeholder="Explain the resolution decision…"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              resolveMut.mutate({
                id: disputeId,
                data: { targetStatus, resolution },
              })
            }
            disabled={!resolution.trim() || resolveMut.isPending}
          >
            Resolve dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KycQueueCard({ item }: { item: import("@workspace/api-client-react").AdminKycQueueItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const approveMut = useApproveKyc({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminKycQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/users"] });
        toast({ title: "Approved", description: `${item.businessName} is now verified.` });
      },
      onError: (err) => {
        toast({ title: "Error", description: getErrorMessage(err, "Failed to approve"), variant: "destructive" });
      },
    },
  });

  const rejectMut = useRejectKyc({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminKycQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/users"] });
        toast({ title: "Rejected", description: `${item.businessName} has been notified.` });
        setShowRejectInput(false);
        setRejectReason("");
      },
      onError: (err) => {
        toast({ title: "Error", description: getErrorMessage(err, "Failed to reject"), variant: "destructive" });
      },
    },
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{item.businessName}</span>
              <Badge variant="outline" className="capitalize">{item.role}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{item.phone}</p>
            {item.ghanaCardNumber && (
              <p className="text-sm font-mono text-muted-foreground">
                Ghana Card: {item.ghanaCardNumber}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Submitted {new Date(item.kycSubmittedAt).toLocaleDateString("en-GH", {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {item.documents.map((doc) => (
              <a
                key={doc.docType}
                href={doc.storageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {doc.docType === "ghana_card_front" ? "Card front" : "Card back"}
              </a>
            ))}
          </div>
        </div>

        {showRejectInput ? (
          <div className="space-y-2">
            <Input
              placeholder="Reason for rejection (shown to the user)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                disabled={rejectMut.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!rejectReason.trim() || rejectMut.isPending}
                onClick={() => rejectMut.mutate({ userId: item.id, data: { reason: rejectReason } })}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                {rejectMut.isPending ? "Rejecting…" : "Confirm rejection"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={approveMut.isPending}
              onClick={() => approveMut.mutate({ userId: item.id })}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {approveMut.isPending ? "Approving…" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setShowRejectInput(true)}
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatKycDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function KycStatusBadge({ status }: { status: KycStatus }) {
  switch (status) {
    case "none":
      return <Badge variant="secondary">Not submitted</Badge>;
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
          Approved
        </Badge>
      );
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
