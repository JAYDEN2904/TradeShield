import { useAuth } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { normalizeMomoNumber } from "@/lib/phone";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, ShieldCheck, Clock, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { VerifiedBadge } from "@/components/design-system";
import type { KycStatus } from "@workspace/api-client-react";

const settingsSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  location: z.string().min(1, "Location is required"),
  category: z.string().optional(),
  payoutMomoNumber: z.string().optional(),
});

export default function Settings() {
  const { user, activeRole, setActiveRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMut = useUpdateCurrentUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Profile updated successfully" });
      },
      onError: (err) => {
        toast({ title: "Error", description: getErrorMessage(err, "Failed to update profile"), variant: "destructive" });
      }
    }
  });

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: user?.businessName || "",
      location: user?.location || "",
      category: user?.category || "",
      payoutMomoNumber: user?.payoutMomoNumber || "",
    }
  });

  if (!user) return null;

  function onSubmit(values: z.infer<typeof settingsSchema>) {
    const needsPayout = user!.role === "supplier" || user!.role === "both";
    if (needsPayout && normalizeMomoNumber(values.payoutMomoNumber ?? "") === null) {
      form.setError("payoutMomoNumber", {
        message: "Valid payout mobile money number is required for suppliers",
      });
      return;
    }
    updateMut.mutate({ data: values });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Settings</h1>

      {user.role === "both" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Active view</CardTitle>
            <CardDescription>
              Choose whether you&apos;re browsing as a buyer or managing sales as a supplier.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              type="button"
              variant={activeRole === "buyer" ? "default" : "outline"}
              onClick={() => setActiveRole("buyer")}
            >
              Buying
            </Button>
            <Button
              type="button"
              variant={activeRole === "supplier" ? "default" : "outline"}
              onClick={() => setActiveRole("supplier")}
            >
              Selling
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Verification</CardTitle>
          <CardDescription>
            Verify your identity to earn a Verified badge and unlock high-value orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerificationStatusSection kycStatus={user.kycStatus} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Profile</CardTitle>
          <CardDescription>Update your public business information</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(user.role === "supplier" || user.role === "both") && (
                <FormField
                  control={form.control}
                  name="payoutMomoNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payout Mobile Money Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={updateMut.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateMut.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function VerificationStatusSection({ kycStatus }: { kycStatus: KycStatus }) {
  switch (kycStatus) {
    case "approved":
      return (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <VerifiedBadge />
            </div>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Your account is verified. You can place orders above GHS 10,000.
            </p>
          </div>
        </div>
      );
    case "pending":
      return (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Verification in progress
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              We&apos;re reviewing your documents — usually done within 24 hours.
            </p>
          </div>
        </div>
      );
    case "rejected":
      return (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Verification needs attention</p>
            <p className="text-sm text-muted-foreground">
              Please review the feedback and resubmit your documents.
            </p>
            <Link href="/verify">
              <Button variant="outline" size="sm">
                Resubmit documents
              </Button>
            </Link>
          </div>
        </div>
      );
    case "none":
      return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Upload your Ghana Card to get a Verified badge and unlock high-value orders.
          </p>
          <Link href="/verify">
            <Button variant="cta" size="sm">
              Get Verified
            </Button>
          </Link>
        </div>
      );
    default: {
      const _exhaustive: never = kycStatus;
      return _exhaustive;
    }
  }
}
