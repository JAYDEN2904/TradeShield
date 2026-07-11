import { OrderStatus, type OrderStatus as OrderStatusType } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { getOrderStatusConfig } from "@/lib/order-status-config";

export type OrderStatusBadgeProps = {
  status: OrderStatusType;
  /** Larger treatment for escrow and other trust-critical states */
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: {
    wrap: "gap-1 px-2 py-0.5 text-[11px] rounded-md",
    icon: "h-3 w-3",
  },
  md: {
    wrap: "gap-1.5 px-2.5 py-1 text-xs rounded-lg",
    icon: "h-3.5 w-3.5",
  },
  lg: {
    wrap: "gap-2 px-3.5 py-1.5 text-sm rounded-lg",
    icon: "h-4 w-4",
  },
};

export function OrderStatusBadge({
  status,
  size = "md",
  showIcon = true,
  className,
}: OrderStatusBadgeProps) {
  const config = getOrderStatusConfig(status);
  const Icon = config.icon;
  const sizes = sizeClasses[size];
  const isProminent = config.prominent && size !== "sm";

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold leading-none whitespace-nowrap",
        config.badgeClass,
        sizes.wrap,
        isProminent && "shadow-ts-sm",
        className,
      )}
      data-testid={`status-${status}`}
      role="status"
      aria-label={`Order status: ${config.label}`}
    >
      {showIcon && (
        <Icon
          className={cn(
            sizes.icon,
            config.iconClass,
            status === OrderStatus.payment_processing && "animate-spin",
          )}
          aria-hidden
        />
      )}
      <span>{config.label}</span>
    </span>
  );
}

/** Re-export for backward compatibility with existing imports */
export { OrderStatusBadge as StatusBadge };
