import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

import { useRequestOtp, useVerifyOtp, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const phoneSchema = z.object({
  phone: z.string().min(6, "Phone number must be at least 6 digits"),
});

const otpSchema = z.object({
  code: z.string().length(6, "OTP must be 6 digits"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");

  const requestOtpMut = useRequestOtp({
    mutation: {
      onSuccess: (data) => {
        setStep("otp");
        if (data.debugCode) {
          toast({ title: "Debug Mode", description: `Use code: ${data.debugCode}` });
        }
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to send OTP", variant: "destructive" });
      }
    }
  });

  const verifyOtpMut = useVerifyOtp({
    mutation: {
      onSuccess: (data) => {
        if (data.needsRegistration) {
          setLocation(`/register?phone=${encodeURIComponent(phoneNumber)}`);
        } else {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          setLocation("/");
        }
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Invalid OTP", variant: "destructive" });
      }
    }
  });

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" }
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" }
  });

  function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    setPhoneNumber(values.phone);
    requestOtpMut.mutate({ data: { phone: values.phone } });
  }

  function onOtpSubmit(values: z.infer<typeof otpSchema>) {
    verifyOtpMut.mutate({ data: { phone: phoneNumber, code: values.code } });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">TradeShield</h1>
          <p className="text-sm text-muted-foreground">Secure B2B trading starts here</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle>{step === "phone" ? "Welcome back" : "Verify your number"}</CardTitle>
            <CardDescription>
              {step === "phone" 
                ? "Enter your phone number to log in or create an account."
                : `We've sent a code to ${phoneNumber}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "phone" ? (
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
                  <FormField
                    control={phoneForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 0241234567" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={requestOtpMut.isPending} data-testid="btn-request-otp">
                    {requestOtpMut.isPending ? "Sending..." : "Continue"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
                  <FormField
                    control={otpForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormLabel className="sr-only">One-Time Password</FormLabel>
                        <FormControl>
                          <InputOTP maxLength={6} {...field} data-testid="input-otp">
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={verifyOtpMut.isPending} data-testid="btn-verify-otp">
                    {verifyOtpMut.isPending ? "Verifying..." : "Verify & Log In"}
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <Button variant="link" size="sm" type="button" onClick={() => setStep("phone")} data-testid="btn-change-phone">
                      Change phone number
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
