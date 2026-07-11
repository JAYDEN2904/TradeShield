import { ShieldCheck, Truck, Wallet, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Wallet,
    title: "Pay to escrow",
    detail: "Funds held by TradeShield, not sent to supplier",
  },
  {
    icon: Truck,
    title: "Supplier ships",
    detail: "They ship only after payment is secured",
  },
  {
    icon: CheckCircle2,
    title: "You confirm",
    detail: "Payment releases when you confirm receipt",
  },
] as const;

export type EscrowExplainerProps = {
  className?: string;
  compact?: boolean;
};

export function EscrowExplainer({ className, compact = false }: EscrowExplainerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-trust/25 bg-trust-muted/30 p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-trust shrink-0" />
        <p className="font-semibold text-sm text-foreground">
          How TradeShield escrow protects you
        </p>
      </div>
      <ol className={cn("grid gap-4", compact ? "grid-cols-1" : "sm:grid-cols-3")}>
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-trust/15 text-trust font-bold text-xs">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-trust shrink-0" />
                  {step.title}
                </p>
                {!compact && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
