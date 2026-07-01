import { useParams, useLocation, Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useGetProduct, getGetProductQueryKey, useGetUser, getGetUserQueryKey, useGetSupplierStats, getGetSupplierStatsQueryKey, useCreateOrder } from "@workspace/api-client-react";
import { Package, ShieldCheck, Star, MapPin, Store, ArrowRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function ProductDetail() {
  const { id } = useParams();
  const productId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: product, isLoading: productLoading } = useGetProduct(productId, {
    query: { enabled: !!productId, queryKey: getGetProductQueryKey(productId) }
  });

  const supplierId = product?.supplierId;

  const { data: supplier, isLoading: supplierLoading } = useGetUser(supplierId!, {
    query: { enabled: !!supplierId, queryKey: getGetUserQueryKey(supplierId!) }
  });

  const { data: stats } = useGetSupplierStats(supplierId!, {
    query: { enabled: !!supplierId, queryKey: getGetSupplierStatsQueryKey(supplierId!) }
  });

  const [quantity, setQuantity] = useState(product?.moq || 1);

  const createOrderMut = useCreateOrder({
    mutation: {
      onSuccess: (order) => {
        toast({ title: "Order Placed", description: "Your order is pending supplier confirmation." });
        setLocation(`/orders/${order.id}`);
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to place order", variant: "destructive" });
      }
    }
  });

  if (productLoading || supplierLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Skeleton className="h-[400px] w-full rounded-xl mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!product || !supplier) {
    return <div className="p-8 text-center">Product not found</div>;
  }

  const handleOrder = () => {
    if (!user) {
      setLocation(`/login?returnTo=/products/${product.id}`);
      return;
    }
    if (quantity < product.moq) {
      toast({ title: "Invalid Quantity", description: `Minimum order quantity is ${product.moq}`, variant: "destructive" });
      return;
    }
    createOrderMut.mutate({ data: { productId: product.id, quantity } });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-12">
        <div className="aspect-[4/3] bg-muted rounded-xl overflow-hidden relative border shadow-sm">
          {product.photoUrl ? (
            <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              <Package className="h-24 w-24" />
            </div>
          )}
          <Badge className="absolute top-4 left-4" variant="secondary">{product.category}</Badge>
          {!product.isActive && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <Badge variant="destructive" className="text-lg px-4 py-1">Currently Unavailable</Badge>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{product.name}</h1>
          <p className="text-3xl font-bold text-primary mb-6">
            ₵{product.unitPrice} <span className="text-lg text-muted-foreground font-normal">/ {product.unit}</span>
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 bg-muted/30 p-4 rounded-lg border">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Minimum Order</p>
              <p className="font-semibold">{product.moq} {product.unit}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Available Stock</p>
              <p className="font-semibold">{product.stockQty} {product.unit}</p>
            </div>
          </div>

          <Card className="mb-8 border-primary/20 shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                Supplier Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg mb-1">{supplier.businessName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {supplier.location}
                  </p>
                </div>
                <Link href={`/suppliers/${supplier.id}`}>
                  <Button variant="outline" size="sm">View Profile</Button>
                </Link>
              </div>

              {stats && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
                    <span className="font-medium">{stats.averageRating ? stats.averageRating.toFixed(1) : "New"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    <span>{stats.completedOrders} orders</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-auto space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Quantity</label>
              <div className="flex items-center">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setQuantity(Math.max(product.moq, quantity - 1))}
                  disabled={quantity <= product.moq || !product.isActive}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input 
                  type="number" 
                  className="w-20 text-center mx-2" 
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(product.moq, parseInt(e.target.value) || product.moq))}
                  min={product.moq}
                  max={product.stockQty}
                  disabled={!product.isActive}
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setQuantity(Math.min(product.stockQty, quantity + 1))}
                  disabled={quantity >= product.stockQty || !product.isActive}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex justify-between items-center py-4 border-t border-b">
              <span className="font-medium">Total Price:</span>
              <span className="text-2xl font-bold">₵{(parseFloat(product.unitPrice) * quantity).toFixed(2)}</span>
            </div>

            <Button 
              size="lg" 
              className="w-full text-lg h-14" 
              onClick={handleOrder}
              disabled={createOrderMut.isPending || !product.isActive || (user?.id === product.supplierId)}
              data-testid="btn-place-order"
            >
              <ShieldCheck className="mr-2 h-5 w-5" />
              {createOrderMut.isPending ? "Processing..." : "Place Escrow Order"}
            </Button>
            {user?.id === product.supplierId && (
              <p className="text-sm text-center text-muted-foreground">You cannot order your own product.</p>
            )}
            <p className="text-xs text-center text-muted-foreground">
              Your payment will be held securely in escrow until you confirm receipt of goods.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
