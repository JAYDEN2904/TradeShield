import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useForgotPassword,
  useResetPassword,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { normalizeGhanaPhone } from "@/lib/phone";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Logo } from "@/components/logo";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Heading } from "@/components/ui/heading";

const phoneSchema = z.object({
  phone: z
    .string()
    .min(9)
    .refine((v) => normalizeGhanaPhone(v) !== null, "Enter a valid Ghana mobile number"),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const RESEND_COOLDOWN_SEC = 30;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const forgotMut = useForgotPassword({
    mutation: {
      onSuccess: (data) => {
        setStep("reset");
        setResendIn(RESEND_COOLDOWN_SEC);
        if (data.debugCode) {
          toast({ title: "Debug code", description: data.debugCode });
        }
        toast({ title: "Code sent", description: data.message });
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: getErrorMessage(err, "Could not send reset code"),
          variant: "destructive",
        });
      },
    },
  });

  const resetMut = useResetPassword({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Password updated" });
        setLocation("/");
      },
      onError: (err) => {
        toast({
          title: "Reset failed",
          description: getErrorMessage(err, "Invalid code or password"),
          variant: "destructive",
        });
      },
    },
  });

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    setPhone(values.phone);
    forgotMut.mutate({ data: { phone: values.phone } });
  }

  function onResetSubmit(values: z.infer<typeof passwordSchema>) {
    if (otpCode.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    resetMut.mutate({
      data: { phone, code: otpCode, password: values.password },
    });
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <Logo variant="lockup" size="xl" />
        </div>
        <Heading level="h3" className="text-center mb-6">
          Reset password
        </Heading>
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">
              {step === "phone" ? "Request reset code" : "Set new password"}
            </CardTitle>
            <CardDescription>
              {step === "phone"
                ? "We'll text a code if an account exists for this number."
                : `Enter the code sent to ${phone}.`}
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
                        <FormLabel>Phone number</FormLabel>
                        <FormControl>
                          <Input placeholder="024 123 4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={forgotMut.isPending}>
                    Send reset code
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={setOtpCode}
                    inputMode="numeric"
                    pattern={REGEXP_ONLY_DIGITS}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Form {...passwordForm}>
                  <form
                    onSubmit={passwordForm.handleSubmit(onResetSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={passwordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New password</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
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
                    <Button type="submit" variant="cta" className="w-full" disabled={resetMut.isPending}>
                      Update password
                    </Button>
                  </form>
                </Form>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  disabled={resendIn > 0 || forgotMut.isPending}
                  onClick={() => forgotMut.mutate({ data: { phone } })}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </Button>
              </div>
            )}
            <p className="text-center text-sm mt-6">
              <Link href="/login" className="text-primary hover:underline">
                Back to log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
