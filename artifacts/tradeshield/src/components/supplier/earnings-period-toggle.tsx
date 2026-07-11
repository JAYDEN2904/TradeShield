import { GetSupplierDashboardEarningsPeriod } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export type EarningsPeriod = "week" | "month" | "all";

const OPTIONS: { value: EarningsPeriod; label: string }[] = [
  { value: GetSupplierDashboardEarningsPeriod.week, label: "This week" },
  { value: GetSupplierDashboardEarningsPeriod.month, label: "This month" },
  { value: GetSupplierDashboardEarningsPeriod.all, label: "All time" },
];

export function EarningsPeriodToggle({
  value,
  onChange,
}: {
  value: EarningsPeriod;
  onChange: (period: EarningsPeriod) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/50 p-0.5 text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-3 py-1.5 font-medium transition-colors duration-100",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
