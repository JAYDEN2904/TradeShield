import { Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/use-countdown";

export type AutoReleaseCountdownProps = {
  autoReleaseAt: string | null | undefined;
  className?: string;
};

const AUTO_RELEASE_WINDOW_MS = 72 * 60 * 60 * 1000;

export function AutoReleaseCountdown({
  autoReleaseAt,
  className,
}: AutoReleaseCountdownProps) {
  const countdown = useCountdown(autoReleaseAt, AUTO_RELEASE_WINDOW_MS);

  if (!countdown) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-muted/40 p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Clock className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {countdown.isExpired
              ? "Auto-release window elapsed"
              : "Auto-release countdown"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {countdown.isExpired
              ? "Funds will release automatically if not already processing."
              : "If you don't confirm or dispute, payment releases automatically when this timer ends."}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className={cn(
              "font-mono text-lg font-semibold tabular-nums",
              countdown.remainingMs < 3600000 && !countdown.isExpired
                ? "text-amber-600 dark:text-amber-400"
                : "text-foreground",
            )}
          >
            {countdown.label}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            remaining
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="h-2 w-full rounded-full bg-border/80 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-1000 ease-linear",
              countdown.isExpired ? "bg-trust w-full" : "bg-primary",
            )}
            style={{ width: `${countdown.progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
          <span>Shipped</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-trust" />
            Auto-release
          </span>
        </div>
      </div>
    </div>
  );
}
