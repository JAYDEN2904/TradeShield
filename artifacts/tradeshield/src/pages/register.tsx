import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const registerSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  location: z.string().min(1, "Location is required"),
  role: z.enum(["buyer", "supplier", "both"]),
  category: z.string().optional(),
  payoutMomoNumber: z.string().optional(),
});

export default function Register() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const phone = searchParams.get("phone") || "";
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const registerMut = useRegister({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setLocation("/");
      },
      onError: (err) => {
        toast({ title: "Registration failed", description: err.error || "An error occurred", variant: "destructive" });
      }
    }
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      businessName: "",
      location: "",
      role: "buyer",
      category: "",
      payoutMomoNumber: "",
    }
  });

  function onSubmit(values: z.infer<typeof registerSchema>) {
    if (!phone) {
      toast({ title: "Missing Phone", description: "Phone number is required. Start from login.", variant: "destructive" });
      setLocation("/login");
      return;
    }
    registerMut.mutate({ data: { phone, ...values } });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 bg-muted/30">
      <div className="w-full max-w-xl">
        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle>Complete your profile</CardTitle>
            <CardDescription>Tell us about your business to finish setting up your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Trading Ltd" {...field} data-testid="input-business-name" />
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
                          <Input placeholder="Accra, Makola Market" {...field} data-testid="input-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>I want to use TradeShield to...</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                          data-testid="group-role"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                            <FormControl>
                              <RadioGroupItem value="buyer" data-testid="radio-buyer" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer flex-1">Buy wholesale goods securely</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                            <FormControl>
                              <RadioGroupItem value="supplier" data-testid="radio-supplier" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer flex-1">Supply goods to retailers</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                            <FormControl>
                              <RadioGroupItem value="both" data-testid="radio-both" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer flex-1">Both buy and supply</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Category <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Electronics, Textiles" {...field} data-testid="input-category" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payoutMomoNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payout Mobile Money Number <span className="text-muted-foreground font-normal">(For suppliers)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 0241234567" {...field} data-testid="input-payout-momo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={registerMut.isPending} data-testid="btn-register">
                  {registerMut.isPending ? "Creating Account..." : "Complete Registration"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
