import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  useLogin,
  useRequestOtp,
  useVerifyOtp,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Logo } from "@/components/logo";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const loginSchema = z.object({
  phone: z
    .string()
    .min(9, "Enter your phone number")
    .refine((v) => normalizeGhanaPhone(v) !== null, "Enter a valid Ghana mobile number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signupPhoneSchema = z.object({
  phone: z
    .string()
    .min(9, "Enter your phone number")
    .refine((v) => normalizeGhanaPhone(v) !== null, "Enter a valid Ghana mobile number"),
});

const RESEND_COOLDOWN_SEC = 30;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [signupStep, setSignupStep] = useState<"phone" | "otp">("phone");
  const [signupPhone, setSignupPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const loginMut = useLogin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setLocation("/");
      },
      onError: (err) => {
        toast({
          title: "Login failed",
          description: getErrorMessage(err, "Invalid phone or password"),
          variant: "destructive",
        });
      },
    },
  });

  const requestOtpMut = useRequestOtp({
    mutation: {
      onSuccess: (data) => {
        setOtpCode("");
        setOtpError(null);
        setSignupStep("otp");
        setResendIn(RESEND_COOLDOWN_SEC);
        if (data.debugCode) {
          toast({ title: "Debug code", description: data.debugCode });
        }
      },
      onError: (err) => {
        const message = getErrorMessage(err, "Failed to send code");
        const retry = (err as { retryAfterSeconds?: number })?.retryAfterSeconds;
        if (retry) setResendIn(retry);
        toast({ title: "Error", description: message, variant: "destructive" });
      },
    },
  });

  const verifyOtpMut = useVerifyOtp({
    mutation: {
      onSuccess: (data) => {
        if (data.needsRegistration) {
          setLocation(`/register?phone=${encodeURIComponent(signupPhone)}`);
        }
      },
      onError: (err) => {
        toast({
          title: "Invalid code",
          description: getErrorMessage(err, "Check the code and try again"),
          variant: "destructive",
        });
      },
    },
  });

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const signupPhoneForm = useForm<z.infer<typeof signupPhoneSchema>>({
    resolver: zodResolver(signupPhoneSchema),
    defaultValues: { phone: "" },
  });

  function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    const phone = normalizeGhanaPhone(values.phone);
    if (!phone) return;
    loginMut.mutate({ data: { phone, password: values.password } });
  }

  function onSignupPhoneSubmit(values: z.infer<typeof signupPhoneSchema>) {
    setSignupPhone(values.phone);
    requestOtpMut.mutate({ data: { phone: values.phone } });
  }

  function onOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError("Code must be 6 digits");
      return;
    }
    setOtpError(null);
    verifyOtpMut.mutate({ data: { phone: signupPhone, code: otpCode } });
  }

  function resendOtp() {
    if (resendIn > 0) return;
    requestOtpMut.mutate({ data: { phone: signupPhone } });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo variant="lockup" size="xl" showTagline className="flex-col sm:flex-row text-center sm:text-left" />
          <p className="text-sm text-muted-foreground">Secure B2B trading starts here</p>
        </div>

        <Card className="shadow-ts-md border-border/80">
          <Tabs defaultValue="login">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="login" className="mt-0 space-y-4">
                <CardDescription className="text-sm">
                  Use your phone number and password.
                </CardDescription>
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="024 123 4567"
                              autoComplete="tel"
                              {...field}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="current-password"
                              {...field}
                              data-testid="input-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      variant="cta"
                      className="w-full"
                      disabled={loginMut.isPending}
                      data-testid="btn-login"
                    >
                      {loginMut.isPending ? "Signing in…" : "Log in"}
                    </Button>
                  </form>
                </Form>
                <p className="text-center text-sm">
                  <Link href="/forgot-password" className="text-primary hover:underline">
                    Forgot password?
                  </Link>
                </p>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 space-y-4">
                {signupStep === "phone" ? (
                  <>
                    <CardDescription>
                      Verify your phone with a one-time code, then set up your business profile.
                    </CardDescription>
                    <Form {...signupPhoneForm}>
                      <form
                        onSubmit={signupPhoneForm.handleSubmit(onSignupPhoneSubmit)}
                        className="space-y-4"
                      >
                        <FormField
                          control={signupPhoneForm.control}
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
                        <Button
                          type="submit"
                          variant="cta"
                          className="w-full"
                          disabled={requestOtpMut.isPending}
                          data-testid="btn-request-otp"
                        >
                          {requestOtpMut.isPending ? "Sending…" : "Send verification code"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    </Form>
                  </>
                ) : (
                  <form onSubmit={onOtpSubmit} className="space-y-6">
                    <CardDescription>
                      Enter the 6-digit code sent to {signupPhone}.
                    </CardDescription>
                    <div className="flex flex-col items-center gap-2">
                      <InputOTP
                        maxLength={6}
                        value={otpCode}
                        onChange={(value) => {
                          setOtpCode(value);
                          if (otpError) setOtpError(null);
                        }}
                        inputMode="numeric"
                        pattern={REGEXP_ONLY_DIGITS}
                        autoComplete="one-time-code"
                        data-testid="input-otp"
                      >
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      {otpError ? (
                        <p className="text-[0.8rem] font-medium text-destructive">{otpError}</p>
                      ) : null}
                    </div>
                    <Button
                      type="submit"
                      variant="cta"
                      className="w-full"
                      disabled={verifyOtpMut.isPending}
                      data-testid="btn-verify-otp"
                    >
                      {verifyOtpMut.isPending ? "Verifying…" : "Continue"}
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </Button>
                    <div className="flex flex-col items-center gap-2 text-sm">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        disabled={resendIn > 0 || requestOtpMut.isPending}
                        onClick={resendOtp}
                      >
                        {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setSignupStep("phone");
                          setOtpCode("");
                        }}
                      >
                        Change phone number
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
