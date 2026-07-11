import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/heading";

export type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
  /** Use serif display sizing for marketing-style pages */
  display?: boolean;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  badge,
  className,
  display = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-2 min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-trust">
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={display ? "display" : "h1"} className="text-balance">
            {title}
          </Heading>
          {badge}
        </div>
        {description && (
          <p className="text-muted-foreground text-base max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
