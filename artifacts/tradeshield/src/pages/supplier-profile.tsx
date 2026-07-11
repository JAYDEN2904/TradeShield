import { useParams, Link } from "wouter";
import {
  useGetUser,
  getGetUserQueryKey,
  useGetSupplierStats,
  getGetSupplierStatsQueryKey,
  useListProducts,
  getListProductsQueryKey,
  useListUserRatings,
  getListUserRatingsQueryKey,
} from "@workspace/api-client-react";
import { Store, Star, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SupplierTrustBadge, VerifiedBadge } from "@/components/design-system";
import { formatGhs } from "@/lib/format";
import { formatCompletionRate } from "@/lib/supplier-trust";

export default function SupplierProfile() {
  const { id } = useParams();
  const supplierId = parseInt(id || "0", 10);

  const { data: supplier, isLoading: supplierLoading } = useGetUser(supplierId, {
    query: { enabled: !!supplierId, queryKey: getGetUserQueryKey(supplierId) },
  });

  const { data: stats } = useGetSupplierStats(supplierId, {
    query: { enabled: !!supplierId, queryKey: getGetSupplierStatsQueryKey(supplierId) },
  });

  const { data: products, isLoading: productsLoading } = useListProducts(
    { supplierId },
    {
      query: { enabled: !!supplierId, queryKey: getListProductsQueryKey({ supplierId }) },
    },
  );

  const { data: ratings } = useListUserRatings(supplierId, {
    query: { enabled: !!supplierId, queryKey: getListUserRatingsQueryKey(supplierId) },
  });

  if (supplierLoading) {
    return (
      <div className="ts-container py-8">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!supplier) {
    return <div className="p-8 text-center text-muted-foreground">Supplier not found</div>;
  }

  const activeProducts = products?.filter((p) => p.isActive) ?? [];

  return (
    <div className="ts-container py-8 md:py-10 max-w-6xl">
      <Card className="overflow-hidden mb-8">
        <div className="h-28 bg-primary/10" />
        <div className="px-6 pb-6 pt-0 relative">
          <div className="absolute -top-12 left-6 h-24 w-24 bg-background rounded-xl border-4 border-background flex items-center justify-center shadow-sm">
            <Store className="h-10 w-10 text-primary" />
          </div>

          <div className="mt-14 flex flex-col lg:flex-row justify-between items-start gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PageHeader
                  title={supplier.businessName}
                  description={supplier.location}
                  className="mb-0"
                />
                {supplier.kycStatus === "approved" && (
                  <VerifiedBadge className="mt-0.5 shrink-0" />
                )}
              </div>
              {supplier.category && (
                <Badge variant="outline" className="ml-0.5">
                  {supplier.category}
                </Badge>
              )}
            </div>

            {stats && (
              <Card className="w-full lg:w-auto lg:min-w-[280px] border-trust/20 bg-trust-muted/20">
                <CardContent className="p-5">
                  <SupplierTrustBadge stats={stats} />
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60">
                    {formatCompletionRate(stats)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold">
            Products ({activeProducts.length})
          </h2>

          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          ) : activeProducts.length === 0 ? (
            <div className="text-center py-12 border rounded-xl border-dashed">
              <p className="text-muted-foreground">
                This supplier currently has no active products.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeProducts.map((product) => (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full overflow-hidden">
                    <div className="h-32 bg-muted relative">
                      {product.photoUrl ? (
                        <img
                          src={product.photoUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                      {product.stockQty === 0 && (
                        <Badge className="absolute bottom-2 right-2" variant="secondary">
                          Out of stock
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                      <p className="text-primary font-bold mt-1">
                        {formatGhs(product.unitPrice)}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          / {product.unit}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Recent reviews</h2>
          <div className="space-y-4">
            {ratings?.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">No reviews yet.</p>
            ) : (
              ratings?.slice(0, 5).map((rating) => (
                <Card key={rating.id}>
                  <CardContent className="p-4">
                    <div className="flex text-cta mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${star <= rating.stars ? "fill-current" : "text-muted opacity-30"}`}
                        />
                      ))}
                    </div>
                    {rating.comment && (
                      <p className="text-sm text-foreground mb-2">&ldquo;{rating.comment}&rdquo;</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(rating.createdAt).toLocaleDateString()}
                    </p>
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
