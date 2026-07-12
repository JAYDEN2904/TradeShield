import { Star, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatCompletionRate,
  formatSupplierRating,
} from "@/lib/supplier-trust";
import type { SupplierStats } from "@workspace/api-client-react";

type SupplierTrustBadgeProps = {
  stats?: SupplierStats | null;
  /** Catalog card shorthand when full stats aren't loaded */
  supplierIsNew?: boolean;
  supplierCompletedOrders?: number;
  supplierAverageRating?: number | null;
  supplierBusinessName?: string;
  supplierLocation?: string;
  compact?: boolean;
  className?: string;
};

export function SupplierTrustBadge({
  stats,
  supplierIsNew,
  supplierCompletedOrders,
  supplierAverageRating,
  supplierBusinessName,
  supplierLocation,
  compact = false,
  className,
}: SupplierTrustBadgeProps) {
  const isNew =
    stats?.isNewSupplier ?? supplierIsNew ?? (supplierCompletedOrders ?? 0) < 5;
  const ratingLabel = stats
    ? formatSupplierRating(stats)
    : supplierAverageRating != null
      ? supplierAverageRating.toFixed(1)
      : isNew
        ? "New supplier"
        : "No ratings yet";
  const completionLabel = stats ? formatCompletionRate(stats) : null;
  const trades = stats?.completedOrders ?? supplierCompletedOrders ?? 0;

  if (compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
        {supplierBusinessName && (
          <span className="font-medium text-foreground truncate max-w-[160px]">
            {supplierBusinessName}
          </span>
        )}
        {isNew && (
          <Badge variant="trust" className="text-[10px] px-1.5 py-0 h-5 gap-1">
            <Sparkles className="h-3 w-3" />
            New Supplier
          </Badge>
        )}
        <span className="flex items-center gap-0.5 text-muted-foreground">
          <Star className="h-3 w-3 fill-cta text-cta" />
          {ratingLabel}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {(supplierBusinessName || supplierLocation) && (
        <div>
          {supplierBusinessName && (
            <p className="font-semibold text-foreground">{supplierBusinessName}</p>
          )}
          {supplierLocation && (
            <p className="text-sm text-muted-foreground">{supplierLocation}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isNew && (
          <Badge variant="trust" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            New Supplier
          </Badge>
        )}
        {/* Skip redundant "New supplier" star label when the New Supplier badge already says it */}
        {(stats?.averageRating != null ||
          supplierAverageRating != null ||
          !isNew) && (
          <Badge variant="secondary" className="gap-1 font-normal">
            <Star className="h-3.5 w-3.5 fill-cta text-cta" />
            {ratingLabel}
          </Badge>
        )}
        <Badge variant="secondary" className="gap-1 font-normal">
          <ShieldCheck className="h-3.5 w-3.5 text-trust" />
          {trades} trade{trades === 1 ? "" : "s"}
        </Badge>
      </div>

      {completionLabel && (
        <p className="text-sm text-muted-foreground">{completionLabel}</p>
      )}
    </div>
  );
}
