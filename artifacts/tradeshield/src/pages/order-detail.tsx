import { useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  useGetOrder,
  getGetOrderQueryKey,
  useAcceptOrder,
  useRejectOrder,
  usePayOrder,
  useShipOrder,
  useConfirmReceipt,
  useRaiseDispute,
  useCreateRating,
  OrderStatus,
  type OrderDetail,
} from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { formatGhs, formatOrderId } from "@/lib/format";
import { isProcessingStatus } from "@/lib/order-utils";
import { OrderStatusBadge } from "@/components/status-badge";
import {
  EscrowBanner,
  OrderTimeline,
  OrderActionPanel,
  PageHeader,
  PayEscrowDialog,
} from "@/components/design-system";
import type { PayEscrowPayload } from "@/components/design-system/pay-escrow-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Package, AlertTriangle, MapPin, Calendar } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [disputeReason, setDisputeReason] = useState("");
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [paymentOtp, setPaymentOtp] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PayEscrowPayload | null>(
    null,
  );

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: {
      enabled: !!orderId,
      queryKey: getGetOrderQueryKey(orderId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status && isProcessingStatus(status)) return 3000;
        return false;
      },
    },
  });

  const onMutateSuccess = (message?: string) => {
    queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
    queryClient.invalidateQueries({ queryKey: ["/orders"] });
    toast({
      title: "Success",
      description: message ?? "Order updated successfully.",
    });
  };

  const onError = (err: unknown) => {
    toast({
      title: "Error",
      description: getErrorMessage(err, "Action failed"),
      variant: "destructive",
    });
  };

  const isOtpRequiredError = (err: unknown): boolean => {
    if (!(err instanceof ApiError)) return false;
    if (err.status !== 428) return false;
    const data = err.data as { code?: string } | null;
    return data?.code === "OTP_REQUIRED";
  };

  const acceptMut = useAcceptOrder({
    mutation: {
      onSuccess: () => onMutateSuccess("Order accepted — buyer can now pay."),
      onError,
    },
  });
  const rejectMut = useRejectOrder({
    mutation: { onSuccess: () => onMutateSuccess("Order rejected."), onError },
  });
  const payMut = usePayOrder({
    mutation: {
      onSuccess: () => {
        setIsPayOpen(false);
        setIsOtpOpen(false);
        setPaymentOtp("");
        onMutateSuccess("Payment initiated — approve the prompt on your phone.");
      },
      onError: (err, variables) => {
        // Hard provider rejections / OTP roll the order back to awaiting_payment.
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        queryClient.invalidateQueries({ queryKey: ["/orders"] });
        if (isOtpRequiredError(err)) {
          setIsPayOpen(false);
          setIsOtpOpen(true);
          const momoNumber = variables?.data?.momoNumber;
          toast({
            title: "Verification required",
            description: momoNumber
              ? `Moolre sent a code to ${momoNumber}. Enter the latest code to continue.`
              : "Moolre sent a code to the MoMo number you entered. Enter the latest code to continue payment.",
          });
          return;
        }
        // Keep the OTP dialog open on invalid-code errors so the buyer can retry.
        const message = getErrorMessage(err, "Action failed");
        if (/verification code/i.test(message) || /otp/i.test(message)) {
          setIsOtpOpen(true);
        }
        onError(err);
      },
    },
  });

  const submitPayment = (payload: PayEscrowPayload, otpCode?: string) => {
    setPendingPayment(payload);
    payMut.mutate({
      id: orderId,
      data: {
        momoProvider: payload.momoProvider,
        momoNumber: payload.momoNumber,
        ...(otpCode ? { otpCode } : {}),
      },
    });
  };
  const shipMut = useShipOrder({
    mutation: {
      onSuccess: () => onMutateSuccess("Order marked as shipped."),
      onError,
    },
  });
  const confirmMut = useConfirmReceipt({
    mutation: {
      onSuccess: () => onMutateSuccess("Receipt confirmed — releasing payment."),
      onError,
    },
  });
  const disputeMut = useRaiseDispute({
    mutation: {
      onSuccess: () => {
        onMutateSuccess("Dispute submitted — escrow release paused.");
        setIsDisputeOpen(false);
        setDisputeReason("");
      },
      onError,
    },
  });
  const rateMut = useCreateRating({
    mutation: {
      onSuccess: () => {
        onMutateSuccess("Thank you for your rating.");
        setIsRatingOpen(false);
      },
      onError,
    },
  });

  if (isLoading) {
    return (
      <div className="ts-container py-8 space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-8 text-center text-muted-foreground">Order not found</div>;
  }

  const isBuyer = user?.id === order.buyerId;
  const isSupplier = user?.id === order.supplierId;

  return (
    <div className="ts-container py-8 md:py-10 max-w-5xl pb-28 md:pb-10">
      <PageHeader
        eyebrow="Order"
        title={formatOrderId(order.id)}
        description={`Placed ${new Date(order.createdAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}`}
        badge={
          <OrderStatusBadge
            status={order.status}
            size={
              order.status === OrderStatus.in_escrow ||
              order.status === OrderStatus.disputed ||
              order.status === OrderStatus.post_release_disputed
                ? "lg"
                : "md"
            }
          />
        }
        className="mb-6"
      />

      <EscrowBanner
        status={order.status}
        orderId={order.id}
        amount={order.totalAmount}
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Order progress</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <OrderTimeline status={order.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-lg border border-border/60">
                {order.product?.photoUrl ? (
                  <img
                    src={order.product.photoUrl}
                    alt={order.product.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{order.product?.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {order.quantity} {order.product?.unit} ×{" "}
                    {formatGhs(order.product?.unitPrice ?? "0")}
                  </p>
                </div>
              </div>

              {(order.deliveryLocation || order.preferredDeliveryDate) && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
                  <p className="font-medium">Delivery details</p>
                  {order.deliveryLocation && (
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                      {order.deliveryLocation}
                    </p>
                  )}
                  {order.preferredDeliveryDate && (
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0 mt-0.5" />
                      Preferred:{" "}
                      {new Date(order.preferredDeliveryDate).toLocaleDateString(
                        "en-GH",
                        { dateStyle: "medium" },
                      )}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatGhs(order.totalAmount)}</span>
                </div>
                {isSupplier && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Platform fee
                      <span className="block text-xs font-normal mt-0.5">
                        Deducted from your payout at release
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatGhs(order.platformFee)}
                    </span>
                  </div>
                )}
                <Separator className="my-3" />
                <div className="flex justify-between font-serif text-xl font-semibold">
                  <span>{isBuyer ? "You pay" : "Order value"}</span>
                  <span>{formatGhs(order.totalAmount)}</span>
                </div>
                {isSupplier && (
                  <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                    <span className="text-trust font-medium">Your payout (after fee)</span>
                    <span className="text-trust font-semibold">
                      {formatGhs(
                        Number(order.totalAmount) - Number(order.platformFee),
                      )}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {order.disputes && order.disputes.length > 0 && (
            <>
              {order.disputes.map((dispute) => (
            <Card
              key={dispute.id}
              className={
                dispute.status === "open"
                  ? "border-red-200/80 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                  : "border-border/80"
              }
            >
              <CardHeader>
                <CardTitle
                  className={`flex items-center gap-2 text-base font-sans ${
                    dispute.status === "open"
                      ? "text-red-800 dark:text-red-300"
                      : ""
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                  {dispute.status === "open" ? "Active dispute" : "Dispute resolved"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm bg-background p-3 rounded-lg border">
                  {dispute.reason}
                </p>
                {dispute.resolution && (
                  <div className="text-sm">
                    <p className="font-medium mb-1">Admin resolution</p>
                    <p className="text-muted-foreground">{dispute.resolution}</p>
                  </div>
                )}
              </CardContent>
            </Card>
              ))}
            </>
          )}

          {order.status === OrderStatus.rejected && order.rejectReason && (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base font-sans">Rejection reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.rejectReason}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Trade parties</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PartyCard
                label={`Buyer ${isBuyer ? "(You)" : ""}`}
                name={order.buyer?.businessName ?? "—"}
                location={order.buyer?.location}
                phone={order.buyer?.phone}
                highlighted={isBuyer}
              />
              <PartyCard
                label={`Supplier ${isSupplier ? "(You)" : ""}`}
                name={order.supplier?.businessName ?? "—"}
                location={order.supplier?.location}
                phone={order.supplier?.phone}
                highlighted={isSupplier}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <OrderActionPanel
            order={order}
            isBuyer={!!isBuyer}
            isSupplier={!!isSupplier}
            disputeReason={disputeReason}
            onDisputeReasonChange={setDisputeReason}
            isDisputeOpen={isDisputeOpen}
            onDisputeOpenChange={setIsDisputeOpen}
            isRatingOpen={isRatingOpen}
            onRatingOpenChange={setIsRatingOpen}
            ratingStars={ratingStars}
            onRatingStarsChange={setRatingStars}
            ratingComment={ratingComment}
            onRatingCommentChange={setRatingComment}
            onAccept={() => acceptMut.mutate({ id: orderId })}
            onReject={(reason) =>
              rejectMut.mutate({
                id: orderId,
                data: reason ? { reason } : undefined,
              })
            }
            onPay={() => setIsPayOpen(true)}
            onShip={() => shipMut.mutate({ id: orderId })}
            onConfirm={() => confirmMut.mutate({ id: orderId })}
            onDispute={() =>
              disputeMut.mutate({ id: orderId, data: { reason: disputeReason } })
            }
            onRate={() =>
              rateMut.mutate({
                id: orderId,
                data: { stars: ratingStars, comment: ratingComment },
              })
            }
            isAccepting={acceptMut.isPending}
            isRejecting={rejectMut.isPending}
            isPaying={payMut.isPending}
            isShipping={shipMut.isPending}
            isConfirming={confirmMut.isPending}
            isDisputing={disputeMut.isPending}
            isRating={rateMut.isPending}
          />
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur-md p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-ts-md">
        <MobileActionBar
          order={order}
          isBuyer={!!isBuyer}
          isSupplier={!!isSupplier}
          onAccept={() => acceptMut.mutate({ id: orderId })}
          onPay={() => setIsPayOpen(true)}
          onShip={() => shipMut.mutate({ id: orderId })}
          onConfirm={() => confirmMut.mutate({ id: orderId })}
          isAccepting={acceptMut.isPending}
          isPaying={payMut.isPending}
          isShipping={shipMut.isPending}
          isConfirming={confirmMut.isPending}
        />
      </div>

      <PayEscrowDialog
        open={isPayOpen}
        onOpenChange={setIsPayOpen}
        amount={order.totalAmount}
        defaultPhone={pendingPayment?.momoNumber ?? user?.phone}
        isPaying={payMut.isPending}
        onSubmit={(payload) => submitPayment(payload)}
      />

      <Dialog open={isOtpOpen} onOpenChange={setIsOtpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter verification code</DialogTitle>
            <DialogDescription>
              {pendingPayment?.momoNumber
                ? `Moolre sent an SMS code to ${pendingPayment.momoNumber}. Enter the latest code, then approve the MoMo prompt on that same phone.`
                : "Use the most recent SMS code from Moolre. After it verifies, you should get a mobile money prompt to enter your PIN."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="payment-otp">SMS code</Label>
            <Input
              id="payment-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter code"
              value={paymentOtp}
              onChange={(e) => setPaymentOtp(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOtpOpen(false)}
              disabled={payMut.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="cta"
              disabled={!paymentOtp.trim() || payMut.isPending || !pendingPayment}
              onClick={() => {
                if (!pendingPayment) return;
                submitPayment(pendingPayment, paymentOtp.trim());
              }}
            >
              {payMut.isPending ? "Verifying…" : "Continue payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartyCard({
  label,
  name,
  location,
  phone,
  highlighted,
}: {
  label: string;
  name: string;
  location?: string;
  phone?: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        highlighted ? "border-primary/25 bg-primary/5" : "bg-muted/30 border-border/60"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      <p className="font-semibold">{name}</p>
      {location && (
        <p className="text-sm text-muted-foreground mt-1">{location}</p>
      )}
      {phone && <p className="text-sm text-muted-foreground">{phone}</p>}
    </div>
  );
}

function MobileActionBar({
  order,
  isBuyer,
  isSupplier,
  onAccept,
  onPay,
  onShip,
  onConfirm,
  isAccepting,
  isPaying,
  isShipping,
  isConfirming,
}: {
  order: OrderDetail;
  isBuyer: boolean;
  isSupplier: boolean;
  onAccept: () => void;
  onPay: () => void;
  onShip: () => void;
  onConfirm: () => void;
  isAccepting: boolean;
  isPaying: boolean;
  isShipping: boolean;
  isConfirming: boolean;
}) {
  if (isSupplier && order.status === OrderStatus.pending_supplier_confirmation) {
    return (
      <button
        type="button"
        className="w-full min-h-12 rounded-lg bg-primary text-primary-foreground font-semibold"
        onClick={onAccept}
        disabled={isAccepting}
      >
        Accept order
      </button>
    );
  }

  if (isBuyer && order.status === OrderStatus.awaiting_payment) {
    return (
      <button
        type="button"
        className="w-full min-h-12 rounded-lg bg-cta text-cta-foreground font-semibold"
        onClick={onPay}
        disabled={isPaying}
      >
        Pay {formatGhs(order.totalAmount)} with MoMo
      </button>
    );
  }

  if (isSupplier && order.status === OrderStatus.in_escrow) {
    return (
      <button
        type="button"
        className="w-full min-h-12 rounded-lg bg-trust text-trust-foreground font-semibold"
        onClick={onShip}
        disabled={isShipping}
      >
        Mark as shipped
      </button>
    );
  }

  if (isBuyer && order.status === OrderStatus.shipped) {
    return (
      <button
        type="button"
        className="w-full min-h-12 rounded-lg bg-trust text-trust-foreground font-semibold"
        onClick={onConfirm}
        disabled={isConfirming}
      >
        Confirm receipt
      </button>
    );
  }

  if (isProcessingStatus(order.status)) {
    return (
      <p className="text-center text-sm text-muted-foreground py-2">
        Processing… status updates automatically
      </p>
    );
  }

  return (
    <p className="text-center text-sm text-muted-foreground py-2">
      Scroll up for full order details
    </p>
  );
}
