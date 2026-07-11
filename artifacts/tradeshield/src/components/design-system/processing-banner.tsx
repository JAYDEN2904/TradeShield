import { Loader2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProcessingBannerProps = {
  title: string;
  description: string;
  variant?: "payment" | "payout";
  className?: string;
};

export function ProcessingBanner({
  title,
  description,
  variant = "payment",
  className,
}: ProcessingBannerProps) {
  const isPayment = variant === "payment";

  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        isPayment
          ? "border-violet-200/80 bg-violet-50/70 dark:border-violet-800/50 dark:bg-violet-950/25"
          : "border-amber-200/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/25",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            isPayment ? "bg-violet-600 text-white" : "bg-amber-500 text-white",
          )}
        >
          {isPayment ? (
            <Smartphone className="h-6 w-6" aria-hidden />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          )}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
              isPayment ? "bg-trust animate-pulse" : "bg-trust",
            )}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {description}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full animate-pulse",
                    isPayment ? "bg-violet-400" : "bg-amber-400",
                  )}
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </span>
            <span className="text-xs text-muted-foreground">
              Checking status automatically…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
