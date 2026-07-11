import { CheckCircle2, Circle, Package, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SupplierDashboardOnboarding } from "@workspace/api-client-react";

export function SupplierOnboarding({
  onboarding,
  onAddProduct,
}: {
  onboarding: SupplierDashboardOnboarding;
  onAddProduct: () => void;
}) {
  const steps = [
    {
      done: onboarding.hasProducts,
      icon: Package,
      label: "List your first product",
      action: !onboarding.hasProducts ? (
        <Button size="sm" onClick={onAddProduct}>
          Add product
        </Button>
      ) : null,
    },
    {
      done: onboarding.hasCompletedOrder,
      icon: ShoppingBag,
      label: "Complete your first order",
      action: null,
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Get started</CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete these steps to start receiving orders.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 text-trust shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
            )}
            <span
              className={
                step.done
                  ? "text-sm line-through text-muted-foreground"
                  : "text-sm text-foreground"
              }
            >
              {step.label}
            </span>
            {step.action && <div className="ml-auto">{step.action}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
