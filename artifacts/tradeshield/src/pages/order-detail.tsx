import { useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetOrder, getGetOrderQueryKey, useAcceptOrder, useRejectOrder, usePayOrder, useShipOrder, useConfirmReceipt, useRaiseDispute, useCreateRating, OrderStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { OrderStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Package, ShieldCheck, AlertTriangle, CheckCircle2, Clock, Truck, FileText, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

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

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) }
  });

  const onMutateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
    toast({ title: "Success", description: "Order updated successfully." });
  };

  const onError = (err: any) => {
    toast({ title: "Error", description: err.error || "Action failed", variant: "destructive" });
  };

  const acceptMut = useAcceptOrder({ mutation: { onSuccess: onMutateSuccess, onError } });
  const rejectMut = useRejectOrder({ mutation: { onSuccess: onMutateSuccess, onError } });
  const payMut = usePayOrder({ mutation: { onSuccess: onMutateSuccess, onError } });
  const shipMut = useShipOrder({ mutation: { onSuccess: onMutateSuccess, onError } });
  const confirmMut = useConfirmReceipt({ mutation: { onSuccess: onMutateSuccess, onError } });
  const disputeMut = useRaiseDispute({ mutation: { 
    onSuccess: () => {
      onMutateSuccess();
      setIsDisputeOpen(false);
      setDisputeReason("");
    }, 
    onError 
  }});
  
  const rateMut = useCreateRating({ mutation: {
    onSuccess: () => {
      onMutateSuccess();
      setIsRatingOpen(false);
    },
    onError
  }});

  if (isLoading) {
    return <div className="container p-8"><Skeleton className="h-[500px] w-full" /></div>;
  }

  if (!order) return <div className="p-8 text-center">Order not found</div>;

  const isBuyer = user?.id === order.buyerId;
  const isSupplier = user?.id === order.supplierId;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Order #{order.id.toString().padStart(6, '0')}
            <OrderStatusBadge status={order.status} />
          </h1>
          <p className="text-muted-foreground mt-1">Placed on {new Date(order.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg border">
                {order.product?.photoUrl ? (
                  <img src={order.product.photoUrl} alt={order.product.name} className="w-16 h-16 object-cover rounded" />
                ) : (
                  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{order.product?.name}</h3>
                  <p className="text-muted-foreground">{order.quantity} {order.product?.unit} × ₵{order.product?.unitPrice}</p>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₵{order.totalAmount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee (Escrow)</span>
                  <span>₵{order.platformFee}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>₵{(parseFloat(order.totalAmount) + parseFloat(order.platformFee)).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.dispute && (
            <Card className="border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10">
              <CardHeader>
                <CardTitle className="text-red-800 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Active Dispute
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium mb-1">Reason for dispute:</p>
                <p className="text-sm bg-background p-3 rounded border">{order.dispute.reason}</p>
                <p className="text-xs text-muted-foreground mt-2">Our admin team will review this and resolve it shortly.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Trade Parties</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className={`p-4 rounded-lg border ${isBuyer ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Buyer {isBuyer && "(You)"}</p>
                <p className="font-medium">{order.buyer?.businessName}</p>
                <p className="text-sm text-muted-foreground">{order.buyer?.location}</p>
                <p className="text-sm text-muted-foreground">{order.buyer?.phone}</p>
              </div>
              <div className={`p-4 rounded-lg border ${isSupplier ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Supplier {isSupplier && "(You)"}</p>
                <p className="font-medium">{order.supplier?.businessName}</p>
                <p className="text-sm text-muted-foreground">{order.supplier?.location}</p>
                <p className="text-sm text-muted-foreground">{order.supplier?.phone}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="bg-primary/5 border-b pb-4">
              <CardTitle className="text-lg">Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Supplier Actions */}
              {isSupplier && order.status === OrderStatus.pending_supplier_confirmation && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">Buyer wants to place this order. Please confirm if you can fulfill it.</p>
                  <Button className="w-full" onClick={() => acceptMut.mutate({ orderId })} disabled={acceptMut.isPending}>
                    Accept Order
                  </Button>
                  <Button variant="outline" className="w-full text-destructive" onClick={() => rejectMut.mutate({ orderId })} disabled={rejectMut.isPending}>
                    Reject Order
                  </Button>
                </div>
              )}

              {/* Buyer Actions */}
              {isBuyer && order.status === OrderStatus.awaiting_payment && (
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800 mb-4">
                    <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-2" />
                    <p className="text-sm text-blue-800 dark:text-blue-300">Your money will be held securely in escrow until you confirm receipt.</p>
                  </div>
                  <Button className="w-full" onClick={() => payMut.mutate({ orderId })} disabled={payMut.isPending}>
                    Pay to Escrow
                  </Button>
                </div>
              )}

              {/* Supplier Actions */}
              {isSupplier && order.status === OrderStatus.in_escrow && (
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mb-2" />
                    <p className="text-sm text-green-800 dark:text-green-300">Payment is secured in escrow. You can safely ship the goods.</p>
                  </div>
                  <Button className="w-full" onClick={() => shipMut.mutate({ orderId })} disabled={shipMut.isPending}>
                    <Truck className="mr-2 h-4 w-4" /> Mark as Shipped
                  </Button>
                </div>
              )}

              {/* Buyer Actions */}
              {isBuyer && order.status === OrderStatus.shipped && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">Supplier marked goods as shipped. Please confirm when you receive them to release payment.</p>
                  <Button className="w-full" onClick={() => confirmMut.mutate({ orderId })} disabled={confirmMut.isPending}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Receipt
                  </Button>
                  
                  <Dialog open={isDisputeOpen} onOpenChange={setIsDisputeOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full text-red-600">Raise Dispute</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Raise a Dispute</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">If there is an issue with the delivery or the goods, detail it below. Payment will be frozen until resolved.</p>
                        <Textarea 
                          placeholder="Describe the issue in detail..." 
                          value={disputeReason} 
                          onChange={(e) => setDisputeReason(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDisputeOpen(false)}>Cancel</Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => disputeMut.mutate({ orderId, data: { reason: disputeReason } })}
                          disabled={!disputeReason.trim() || disputeMut.isPending}
                        >
                          Submit Dispute
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* Waiting states (no action needed) */}
              {isBuyer && order.status === OrderStatus.pending_supplier_confirmation && (
                <p className="text-sm text-center text-muted-foreground py-4 flex flex-col items-center">
                  <Clock className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  Waiting for supplier to confirm availability.
                </p>
              )}
              {isSupplier && order.status === OrderStatus.awaiting_payment && (
                <p className="text-sm text-center text-muted-foreground py-4 flex flex-col items-center">
                  <Clock className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  Waiting for buyer to make escrow payment.
                </p>
              )}
              {isSupplier && order.status === OrderStatus.shipped && (
                <p className="text-sm text-center text-muted-foreground py-4 flex flex-col items-center">
                  <Clock className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  Waiting for buyer to confirm receipt. Payment will auto-release in 72h.
                </p>
              )}
              {order.status === OrderStatus.payment_processing && (
                <p className="text-sm text-center text-muted-foreground py-4 flex flex-col items-center">
                  <Clock className="h-8 w-8 text-muted-foreground/50 mb-2 animate-spin" />
                  Payment is processing...
                </p>
              )}
              {order.status === OrderStatus.completed && (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="font-semibold text-green-800 dark:text-green-300">Order Completed</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">Payment has been released to the supplier.</p>
                  </div>
                  
                  {isBuyer && (
                    <Dialog open={isRatingOpen} onOpenChange={setIsRatingOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" variant="outline">
                          <Star className="mr-2 h-4 w-4" /> Rate Supplier
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rate this Trade</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <p className="text-sm text-muted-foreground">How was your experience trading with {order.supplier?.businessName}?</p>
                          <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star 
                                key={star} 
                                className={`h-8 w-8 cursor-pointer ${star <= ratingStars ? 'fill-yellow-400 text-yellow-500' : 'text-muted'}`}
                                onClick={() => setRatingStars(star)}
                              />
                            ))}
                          </div>
                          <Textarea 
                            placeholder="Add a comment (optional)..." 
                            value={ratingComment} 
                            onChange={(e) => setRatingComment(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsRatingOpen(false)}>Cancel</Button>
                          <Button 
                            onClick={() => rateMut.mutate({ orderId, data: { stars: ratingStars, comment: ratingComment } })}
                            disabled={rateMut.isPending}
                          >
                            Submit Rating
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
