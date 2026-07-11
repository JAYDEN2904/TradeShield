import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const headingVariants = cva("font-serif tracking-tight text-foreground", {
  variants: {
    level: {
      display: "text-display font-semibold",
      h1: "text-h1 font-semibold",
      h2: "text-h2 font-semibold",
      h3: "text-h3 font-medium",
      h4: "text-h4 font-medium font-sans",
    },
    muted: {
      true: "text-muted-foreground",
      false: "",
    },
  },
  defaultVariants: {
    level: "h2",
    muted: false,
  },
});

type HeadingLevel = "display" | "h1" | "h2" | "h3" | "h4";

const TAG_MAP: Record<HeadingLevel, "h1" | "h2" | "h3" | "h4" | "p"> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
};

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "p";
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, level = "h2", muted, as, ...props }, ref) => {
    const resolvedLevel = level ?? "h2";
    const Comp = as ?? TAG_MAP[resolvedLevel];
    return (
      <Comp
        ref={ref}
        className={cn(headingVariants({ level: resolvedLevel, muted }), className)}
        {...props}
      />
    );
  },
);
Heading.displayName = "Heading";

export { Heading, headingVariants };
