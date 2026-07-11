import { cn } from "@/lib/utils";

const sizeConfig = {
  sm: { icon: "h-8 w-8", text: "text-base", tagline: "text-[10px]" },
  md: { icon: "h-11 w-11", text: "text-xl", tagline: "text-xs" },
  lg: { icon: "h-14 w-14", text: "text-xl", tagline: "text-sm" },
  xl: { icon: "h-[4.5rem] w-[4.5rem]", text: "text-2xl", tagline: "text-sm" },
} as const;

type LogoSize = keyof typeof sizeConfig;

interface LogoProps {
  variant?: "mark" | "lockup";
  size?: LogoSize;
  showTagline?: boolean;
  className?: string;
  textClassName?: string;
}

export function Logo({
  variant = "lockup",
  size = "md",
  showTagline = false,
  className,
  textClassName,
}: LogoProps) {
  const config = sizeConfig[size];

  if (variant === "mark") {
    return (
      <img
        src="/logo-icon.png"
        alt="TradeShield"
        className={cn(config.icon, "object-contain shrink-0", className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src="/logo-icon.png"
        alt=""
        aria-hidden
        className={cn(config.icon, "object-contain shrink-0")}
      />
      <div className="flex flex-col min-w-0">
        <span
          className={cn(
            "font-serif font-semibold tracking-tight text-foreground leading-none",
            config.text,
            textClassName,
          )}
        >
          TradeShield
        </span>
        {showTagline ? (
          <span className={cn("text-muted-foreground mt-0.5 leading-tight", config.tagline)}>
            Secure wholesaling across Africa
          </span>
        ) : null}
      </div>
    </div>
  );
}
