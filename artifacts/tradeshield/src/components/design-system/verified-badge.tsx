import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  size?: "sm" | "default";
  className?: string;
}

export function VerifiedBadge({ size = "default", className }: VerifiedBadgeProps) {
  if (size === "sm") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center", className)}>
              <ShieldCheck className="h-4 w-4 text-emerald-500" aria-label="Verified" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Verified account</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium text-emerald-600",
        className,
      )}
    >
      <ShieldCheck className="h-4 w-4" />
      Verified
    </span>
  );
}
