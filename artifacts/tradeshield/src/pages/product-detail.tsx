import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  useGetProduct,
  getGetProductQueryKey,
  useGetUser,
  getGetUserQueryKey,
  useGetSupplierStats,
  getGetSupplierStatsQueryKey,
  useCreateOrder,
} from "@workspace/api-client-react";
import {
  Package,
  ShieldCheck,
  MapPin,
  Store,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EscrowExplainer, PageHeader, SupplierTrustBadge } from "@/components/design-system";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { formatGhs } from "@/lib/format";

const PLATFORM_FEE_RATE = 0.02;

export default function ProductDetail() {
  const { id } = useParams();
  const productId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: product, isLoading: productLoading } = useGetProduct(productId, {
    query: { enabled: !!productId, queryKey: getGetProductQueryKey(productId) },
  });

  const supplierId = product?.supplierId;

  const { data: supplier, isLoading: supplierLoading } = useGetUser(supplierId!, {
    query: { enabled: !!supplierId, queryKey: getGetUserQueryKey(supplierId!) },
  });

  const { data: stats } = useGetSupplierStats(supplierId!, {
    query: {
      enabled: !!supplierId,
      queryKey: getGetSupplierStatsQueryKey(supplierId!),
    },
  });

  const [quantity, setQuantity] = useState(1);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState("");

  useEffect(() => {
    if (product?.moq) {
      setQuantity(product.moq);
    }
  }, [product?.moq]);

  useEffect(() => {
    if (user?.location && !deliveryLocation) {
      setDeliveryLocation(user.location);
    }
  }, [user?.location, deliveryLocation]);

  const subtotal = product
    ? parseFloat(product.unitPrice) * quantity
    : 0;
  const platformFee = subtotal * PLATFORM_FEE_RATE;

  const createOrderMut = useCreateOrder({
    mutation: {
      onSuccess: (order) => {
        toast({
          title: "Order placed",
          description: "Pending supplier confirmation before payment.",
        });
        setLocation(`/orders/${order.id}`);
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: getErrorMessage(err, "Failed to place order"),
          variant: "destructive",
        });
      },
    },
  });

  if (productLoading || supplierLoading) {
    return (
      <div className="ts-container-wide py-8">
        <Skeleton className="h-[400px] w-full rounded-xl mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!product || !supplier) {
    return <div className="p-8 text-center text-muted-foreground">Product not found</div>;
  }

  const handleOrder = () => {
    if (!user) {
      setLocation(`/login?returnTo=/products/${product.id}`);
      return;
    }
    if (user.isAdmin) {
      toast({
        title: "Admins cannot place orders",
        description: "Use a non-admin buyer account to place escrow orders.",
        variant: "destructive",
      });
      return;
    }
    if (quantity < product.moq) {
      toast({
        title: "Invalid quantity",
        description: `Minimum order quantity is ${product.moq}`,
        variant: "destructive",
      });
      return;
    }
    if (!deliveryLocation.trim()) {
      toast({
        title: "Delivery location required",
        description: "Enter where goods should be delivered.",
        variant: "destructive",
      });
      return;
    }
    if (!preferredDeliveryDate) {
      toast({
        title: "Preferred date required",
        description: "Choose when you would like delivery.",
        variant: "destructive",
      });
      return;
    }
    createOrderMut.mutate({
      data: {
        productId: product.id,
        quantity,
        deliveryLocation: deliveryLocation.trim(),
        preferredDeliveryDate,
      },
    });
  };

  return (
    <div className="ts-container-wide py-8 md:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
        <div className="aspect-[4/3] lg:aspect-auto lg:min-h-[420px] bg-muted rounded-xl overflow-hidden relative border shadow-ts-sm">
          {product.photoUrl ? (
            <img
              src={product.photoUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/25">
              <Package className="h-24 w-24" />
            </div>
          )}
          <Badge className="absolute top-4 left-4" variant="secondary">
            {product.category}
          </Badge>
          {!product.isActive && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <Badge variant="destructive" className="text-base px-4 py-1">
                Currently unavailable
              </Badge>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <PageHeader
            eyebrow={product.category}
            title={product.name}
            description={`Sold by ${supplier.businessName} · ${supplier.location}`}
          />

          <p className="font-serif text-4xl font-semibold text-foreground -mt-2">
            {formatGhs(product.unitPrice)}{" "}
            <span className="text-lg text-muted-foreground font-sans font-normal">
              / {product.unit}
            </span>
          </p>

          <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Minimum order
              </p>
              <p className="font-semibold">
                {product.moq} {product.unit}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                In stock
              </p>
              <p className="font-semibold">
                {product.stockQty} {product.unit}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-sans font-medium flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-lg">{supplier.businessName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 shrink-0" /> {supplier.location}
                  </p>
                  {stats && (
                    <SupplierTrustBadge stats={stats} className="mt-3" />
                  )}
                </div>
                <Link href={`/suppliers/${supplier.id}`}>
                  <Button variant="outline" size="sm">
                    Profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <EscrowExplainer compact />

          <Card className="border-primary/15">
            <CardContent className="p-5 space-y-5">
              <div className="space-y-3">
                <label className="text-sm font-medium" htmlFor="delivery-location">
                  Delivery location
                </label>
                <Input
                  id="delivery-location"
                  placeholder="e.g. Tema Community 4, Greater Accra"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  disabled={!product.isActive}
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium" htmlFor="preferred-date">
                  Preferred delivery date
                </label>
                <Input
                  id="preferred-date"
                  type="date"
                  value={preferredDeliveryDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setPreferredDeliveryDate(e.target.value)}
                  disabled={!product.isActive}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="quantity">
                  Quantity
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(product.moq, quantity - 1))}
                    disabled={quantity <= product.moq || !product.isActive}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    className="w-20 text-center mx-1"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.max(
                          product.moq,
                          Math.min(
                            product.stockQty,
                            parseInt(e.target.value, 10) || product.moq,
                          ),
                        ),
                      )
                    }
                    min={product.moq}
                    max={product.stockQty}
                    disabled={!product.isActive}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setQuantity(Math.min(product.stockQty, quantity + 1))
                    }
                    disabled={quantity >= product.stockQty || !product.isActive}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatGhs(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Platform fee
                    <span className="block text-xs">Paid by supplier at release</span>
                  </span>
                  <span className="text-muted-foreground">{formatGhs(platformFee)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-serif text-xl font-semibold pt-1">
                  <span>You pay</span>
                  <span>{formatGhs(subtotal)}</span>
                </div>
              </div>

              <Button
                variant="cta"
                size="xl"
                className="w-full"
                onClick={handleOrder}
                disabled={
                  createOrderMut.isPending ||
                  !product.isActive ||
                  user?.id === product.supplierId ||
                  Boolean(user?.isAdmin)
                }
                data-testid="btn-place-order"
              >
                <ShieldCheck className="mr-2 h-5 w-5" />
                {createOrderMut.isPending ? "Placing order…" : "Place escrow order"}
              </Button>

              {user?.isAdmin && (
                <p className="text-sm text-center text-muted-foreground">
                  Admin accounts cannot place orders.
                </p>
              )}

              {user?.id === product.supplierId && (
                <p className="text-sm text-center text-muted-foreground">
                  You cannot order your own product.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
