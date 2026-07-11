import { useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, X, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KycStatus } from "@workspace/api-client-react";

interface VerifyNudgeBannerProps {
  kycStatus: KycStatus;
  className?: string;
}

export function VerifyNudgeBanner({ kycStatus, className }: VerifyNudgeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && kycStatus !== "approved") {
    return null;
  }

  if (kycStatus === "approved") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30",
          className,
        )}
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="flex-1 text-sm text-emerald-800 dark:text-emerald-300">
          <span className="font-medium">Your account is verified.</span> You have a Verified badge
          on your profile and can place high-value orders.
        </p>
      </div>
    );
  }

  if (kycStatus === "none") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3",
          className,
        )}
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm text-foreground">
          <span className="font-medium">Get your Verified badge</span> — unlock high-value
          orders and build trust with buyers.{" "}
          <Link href="/verify" className="font-medium text-primary underline-offset-4 hover:underline">
            Verify now →
          </Link>
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    );
  }

  if (kycStatus === "pending") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30",
          className,
        )}
      >
        <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
          Verification in progress — usually done within 24 hours.
        </p>
      </div>
    );
  }

  if (kycStatus === "rejected") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3",
          className,
        )}
      >
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        <p className="flex-1 text-sm text-foreground">
          <span className="font-medium">Verification needs attention.</span>{" "}
          <Link href="/verify" className="font-medium text-primary underline-offset-4 hover:underline">
            Review and resubmit →
          </Link>
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    );
  }

  return null;
}
