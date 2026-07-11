import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active:scale-[0.98] active:transition-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border shadow-ts-xs hover:shadow-ts-sm",
        cta: "bg-cta text-cta-foreground border border-cta-border shadow-ts-sm hover:shadow-ts-md hover:brightness-[1.02]",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border shadow-ts-xs",
        outline:
          "border border-border bg-background shadow-ts-xs hover:bg-muted/50 hover:border-primary/20",
        secondary:
          "border bg-secondary text-secondary-foreground border-secondary-border shadow-ts-xs",
        ghost: "border border-transparent hover:bg-muted/60",
        trust:
          "bg-trust text-trust-foreground border border-trust/30 shadow-ts-sm hover:brightness-[1.03]",
        link: "text-primary underline-offset-4 hover:underline border-transparent p-0 h-auto min-h-0",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-12 rounded-lg px-6 text-base",
        xl: "min-h-14 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
