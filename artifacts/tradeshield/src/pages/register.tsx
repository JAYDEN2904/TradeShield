import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { normalizeMomoNumber } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/design-system";
import { LOCATION_FILTERS } from "@/lib/catalog-constants";

const registerSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    businessName: z.string().min(1, "Business name is required"),
    location: z.string().min(1, "Location is required"),
    role: z.enum(["buyer", "supplier", "both"]),
    category: z.string().optional(),
    payoutMomoNumber: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      if (data.role === "supplier" || data.role === "both") {
        return normalizeMomoNumber(data.payoutMomoNumber ?? "") !== null;
      }
      return true;
    },
    {
      message: "Valid payout mobile money number is required for suppliers",
      path: ["payoutMomoNumber"],
    },
  );

export default function Register() {
  const [, setLocation] = useLocation();
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
        toast({
          title: "Registration failed",
          description: getErrorMessage(err, "An error occurred"),
          variant: "destructive",
        });
      },
    },
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
      businessName: "",
      location: LOCATION_FILTERS[0],
      role: "buyer",
      category: "",
      payoutMomoNumber: "",
    },
  });

  const selectedRole = form.watch("role");
  const needsPayout = selectedRole === "supplier" || selectedRole === "both";

  function onSubmit(values: z.infer<typeof registerSchema>) {
    if (!phone) {
      toast({
        title: "Missing phone",
        description: "Start from sign up to verify your number first.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    const { confirmPassword: _c, ...rest } = values;
    registerMut.mutate({
      data: {
        phone,
        ...rest,
        payoutMomoNumber: needsPayout ? values.payoutMomoNumber : undefined,
      },
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 bg-muted/30">
      <div className="w-full max-w-xl">
        <PageHeader
          title="Complete your profile"
          description="Set your password and business details to finish creating your account."
          className="mb-6"
        />
        <Card className="shadow-ts-md border-border/80">
          <CardHeader>
            <CardTitle className="font-sans">Account details</CardTitle>
            <CardDescription>
              Phone verified: {phone || "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business name</FormLabel>
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
                          <Input placeholder="Accra, Greater Accra" {...field} data-testid="input-location" />
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
                      <FormLabel>I want to use TradeShield to…</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-1"
                          data-testid="group-role"
                        >
                          {[
                            ["buyer", "Buy wholesale goods securely"],
                            ["supplier", "Supply goods to retailers"],
                            ["both", "Both buy and supply"],
                          ].map(([value, label]) => (
                            <FormItem
                              key={value}
                              className="flex items-center space-x-3 space-y-0 p-3 border rounded-md cursor-pointer hover:bg-muted/50"
                            >
                              <FormControl>
                                <RadioGroupItem value={value} data-testid={`radio-${value}`} />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer flex-1">
                                {label}
                              </FormLabel>
                            </FormItem>
                          ))}
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
                        <FormLabel>
                          Business category{" "}
                          <span className="text-muted-foreground font-normal">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Groceries" {...field} data-testid="input-category" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {needsPayout && (
                    <FormField
                      control={form.control}
                      name="payoutMomoNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payout mobile money number</FormLabel>
                          <FormControl>
                            <Input placeholder="024 123 4567" {...field} data-testid="input-payout-momo" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <Button
                  type="submit"
                  variant="cta"
                  className="w-full"
                  disabled={registerMut.isPending}
                  data-testid="btn-register"
                >
                  {registerMut.isPending ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
