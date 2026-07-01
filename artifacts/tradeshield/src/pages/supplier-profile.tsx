import { useParams, Link } from "wouter";
import { useGetUser, getGetUserQueryKey, useGetSupplierStats, getGetSupplierStatsQueryKey, useListProducts, getListProductsQueryKey, useListUserRatings, getListUserRatingsQueryKey } from "@workspace/api-client-react";
import { Store, MapPin, Star, ShieldCheck, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SupplierProfile() {
  const { id } = useParams();
  const supplierId = parseInt(id || "0", 10);

  const { data: supplier, isLoading: supplierLoading } = useGetUser(supplierId, {
    query: { enabled: !!supplierId, queryKey: getGetUserQueryKey(supplierId) }
  });

  const { data: stats } = useGetSupplierStats(supplierId, {
    query: { enabled: !!supplierId, queryKey: getGetSupplierStatsQueryKey(supplierId) }
  });

  const { data: products, isLoading: productsLoading } = useListProducts({ supplierId }, {
    query: { enabled: !!supplierId, queryKey: getListProductsQueryKey({ supplierId }) }
  });

  const { data: ratings } = useListUserRatings(supplierId, {
    query: { enabled: !!supplierId, queryKey: getListUserRatingsQueryKey(supplierId) }
  });

  if (supplierLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!supplier) return <div className="p-8 text-center">Supplier not found</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-8">
        <div className="h-32 bg-primary/10"></div>
        <div className="px-6 pb-6 pt-0 relative">
          <div className="absolute -top-12 left-6 h-24 w-24 bg-background rounded-xl border-4 border-background flex items-center justify-center shadow-sm overflow-hidden">
            <div className="bg-primary/10 w-full h-full flex items-center justify-center">
              <Store className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          <div className="mt-14 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">{supplier.businessName}</h1>
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" /> {supplier.location}
                {supplier.category && <><span className="mx-2">•</span><Badge variant="outline">{supplier.category}</Badge></>}
              </p>
            </div>
            
            {stats && (
              <div className="flex gap-6 bg-muted/30 px-6 py-3 rounded-lg border">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
                    <Star className="h-5 w-5 fill-current" />
                    <span className="font-bold text-lg text-foreground">{stats.averageRating ? stats.averageRating.toFixed(1) : "New"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Rating</p>
                </div>
                <div className="text-center border-l pl-6">
                  <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="font-bold text-lg text-foreground">{stats.completedOrders}</span>
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Trades</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold">Products ({products?.length || 0})</h2>
          
          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : products?.filter(p => p.isActive).length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <p className="text-muted-foreground">This supplier currently has no active products.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products?.filter(p => p.isActive).map((product) => (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <div className="h-32 bg-muted relative">
                      {product.photoUrl ? (
                        <img src={product.photoUrl} className="w-full h-full object-cover rounded-t-lg" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                      <p className="text-primary font-bold mt-1">₵{product.unitPrice} <span className="text-xs text-muted-foreground font-normal">/{product.unit}</span></p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold mb-6">Recent Reviews</h2>
          <div className="space-y-4">
            {ratings?.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">No reviews yet.</p>
            ) : (
              ratings?.slice(0, 5).map((rating) => (
                <Card key={rating.id}>
                  <CardContent className="p-4">
                    <div className="flex text-yellow-500 mb-2">
                      {[1,2,3,4,5].map(star => (
                        <Star key={star} className={`h-4 w-4 ${star <= rating.stars ? "fill-current" : "text-muted opacity-30"}`} />
                      ))}
                    </div>
                    {rating.comment && <p className="text-sm text-foreground mb-2">"{rating.comment}"</p>}
                    <p className="text-xs text-muted-foreground">{new Date(rating.createdAt).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
