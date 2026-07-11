import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Store, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, VerifyNudgeBanner } from "@/components/design-system";
import { SupplierOverview } from "@/components/supplier/supplier-overview";
import { SupplierProductsPanel } from "@/components/supplier/supplier-products-panel";

export default function Dashboard() {
  const { user, activeRole } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "products">("overview");

  // Guard: if a "both" user has switched to buying mode, redirect away
  if (user && user.role === "both" && activeRole === "buyer") {
    navigate("/");
    return null;
  }

  const greeting = getGreeting();

  return (
    <div className="ts-container py-8 md:py-10 max-w-5xl">
      {user && (
        <VerifyNudgeBanner kycStatus={user.kycStatus} className="mb-6" />
      )}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <PageHeader
          eyebrow={greeting}
          title={user?.businessName ?? "Dashboard"}
          description="Your supplier command center."
          className="mb-0"
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "overview" | "products")}
      >
        <TabsList className="mb-8">
          <TabsTrigger value="overview" className="gap-2">
            <Store className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SupplierOverview onSwitchToProducts={() => setActiveTab("products")} />
        </TabsContent>

        <TabsContent value="products">
          <SupplierProductsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
