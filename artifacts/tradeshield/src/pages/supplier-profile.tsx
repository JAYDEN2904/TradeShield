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
import { MapPin, Store, Star, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading } from "@/components/ui/heading";
import { SupplierTrustBadge, VerifiedBadge } from "@/components/design-system";
import { formatGhs } from "@/lib/format";

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

  const { data: ratings, isLoading: ratingsLoading } = useListUserRatings(supplierId, {
    query: { enabled: !!supplierId, queryKey: getListUserRatingsQueryKey(supplierId) },
  });

  if (supplierLoading) {
    return (
      <div className="ts-container py-8 md:py-10">
        <Skeleton className="h-56 w-full rounded-xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="ts-container py-16 text-center text-muted-foreground">
        Supplier not found
      </div>
    );
  }

  const activeProducts = products?.filter((p) => p.isActive) ?? [];

  return (
    <div className="ts-container py-8 md:py-10">
      <Card className="overflow-hidden mb-8">
        <div className="h-20 sm:h-24 bg-gradient-to-br from-primary/15 via-primary/5 to-trust-muted/30" />

        <div className="px-5 sm:px-6 pb-6 pt-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4 min-w-0">
              <div className="shrink-0 h-16 w-16 sm:h-20 sm:w-20 rounded-xl border bg-background flex items-center justify-center shadow-sm">
                <Store className="h-8 w-8 sm:h-9 sm:w-9 text-primary" />
              </div>

              <div className="min-w-0 space-y-2 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Heading level="h2" as="h1" className="text-balance">
                    {supplier.businessName}
                  </Heading>
                  {supplier.kycStatus === "approved" && (
                    <VerifiedBadge className="shrink-0" />
                  )}
                </div>

                {supplier.location && (
                  <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{supplier.location}</span>
                  </p>
                )}

                {supplier.category && (
                  <Badge variant="outline">{supplier.category}</Badge>
                )}
              </div>
            </div>

            {stats && (
              <div className="w-full lg:w-auto lg:min-w-[260px] rounded-xl border border-trust/20 bg-trust-muted/20 p-4 sm:p-5">
                <SupplierTrustBadge stats={stats} />
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-lg font-semibold tracking-tight">
            Products
            <span className="ml-1.5 text-muted-foreground font-normal">
              ({activeProducts.length})
            </span>
          </h2>

          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          ) : activeProducts.length === 0 ? (
            <div className="text-center py-14 border rounded-xl border-dashed">
              <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                This supplier currently has no active products.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="block h-full"
                >
                  <Card className="h-full overflow-hidden ts-card-interactive group cursor-pointer">
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      {product.photoUrl ? (
                        <img
                          src={product.photoUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/25">
                          <Package className="h-12 w-12" />
                        </div>
                      )}
                      <Badge
                        className="absolute top-3 right-3 bg-background/90 text-foreground backdrop-blur-sm border-0"
                        variant="secondary"
                      >
                        {product.category}
                      </Badge>
                      {product.stockQty === 0 && (
                        <div className="absolute inset-x-0 bottom-0 bg-background/90 text-center text-xs font-medium py-1.5 border-t">
                          Out of stock
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors duration-150">
                        {product.name}
                      </h3>
                      <p className="text-xl font-bold text-foreground">
                        {formatGhs(product.unitPrice)}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          / {product.unit}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        MOQ: {product.moq} {product.unit}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-5">Recent reviews</h2>
          <div className="space-y-3">
            {ratingsLoading ? (
              <>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </>
            ) : !ratings || ratings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reviews yet.</p>
            ) : (
              ratings.slice(0, 5).map((rating) => (
                <Card key={rating.id}>
                  <CardContent className="p-4">
                    <div className="flex text-cta mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= rating.stars
                              ? "fill-current"
                              : "text-muted opacity-30"
                          }`}
                        />
                      ))}
                    </div>
                    {rating.comment && (
                      <p className="text-sm text-foreground mb-2">
                        &ldquo;{rating.comment}&rdquo;
                      </p>
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
