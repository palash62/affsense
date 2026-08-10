"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/layout/auth-layout";

type LoginStep = "credentials" | "code";

function LoginForm() {
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    registered === "verify"
      ? "Account created. Check your email to verify and activate your advertiser account."
      : registered === "publisher-verify"
        ? "Application submitted. Check your email to verify your address. After verification, an admin will review your publisher application."
        : "",
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResend, setShowResend] = useState(false);

  async function handleResendVerification() {
    if (!email.trim()) {
      setError("Enter your email address to resend verification.");
      return;
    }

    setResending(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => null);
      setInfo(data?.message ?? "If an unverified account exists, a new verification link has been sent.");
      setShowResend(false);
    } catch {
      setError("Unable to resend verification email. Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function requestOtpCode(options?: { resend?: boolean }) {
    const isResend = options?.resend === true;
    setError("");
    setInfo("");
    setShowResend(false);

    if (isResend) {
      setResending(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errCode = data?.error?.code;
        setError(data?.error?.message ?? "Unable to send sign-in code.");
        if (errCode === "EMAIL_NOT_VERIFIED") {
          setShowResend(true);
        }
        return false;
      }

      setInfo(data?.message ?? "Check your email for your 6-digit sign-in code.");
      setStep("code");
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      if (isResend) {
        setResending(false);
      } else {
        setLoading(false);
      }
    }
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    await requestOtpCode();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setShowResend(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedCode = code.trim();

      const check = await fetch("/api/v1/auth/otp-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
      });
      const checkData = await check.json().catch(() => null);

      if (!check.ok) {
        const errCode = checkData?.error?.code;
        setError(checkData?.error?.message ?? "Invalid or expired sign-in code.");
        if (errCode === "EMAIL_NOT_VERIFIED") {
          setShowResend(true);
        }
        return;
      }

      const result = await signIn("otp", {
        email: normalizedEmail,
        code: normalizedCode,
        redirect: false,
        callbackUrl: "/",
      });

      if (!result?.ok || result.error) {
        setError("Invalid or expired sign-in code.");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      badge="Secure sign in"
      title="Welcome back"
      description="Sign in to your Affsense account and manage verified lead campaigns."
    >
      {info && (
        <Alert className="mb-4">
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "credentials" ? (
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="rounded-xl border-border bg-transparent"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="authLink shrink-0 text-sm underline-offset-2 hover:underline">
                Forgot Password
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border-border bg-transparent pr-11"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="authPrimaryBtn h-auto w-full" disabled={loading}>
            {loading ? "Sending code..." : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-readonly">Email</Label>
            <Input
              id="email-readonly"
              type="email"
              value={email}
              readOnly
              className="rounded-xl border-border bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="rounded-xl border-border bg-transparent tracking-[0.35em]"
              required
              maxLength={6}
            />
          </div>
          <Button type="submit" className="authPrimaryBtn h-auto w-full" disabled={loading || code.length !== 6}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="authOutlineBtn h-auto flex-1"
              disabled={loading}
              onClick={() => {
                setStep("credentials");
                setCode("");
                setError("");
                setInfo("");
              }}
            >
              Change email
            </Button>
            <Button
              type="button"
              variant="outline"
              className="authOutlineBtn h-auto flex-1"
              disabled={loading || resending}
              onClick={() => void requestOtpCode({ resend: true })}
            >
              {resending ? "Sending..." : "Resend code"}
            </Button>
          </div>
        </form>
      )}

      {showResend && (
        <Button
          type="button"
          variant="outline"
          className="authOutlineBtn mt-4 h-auto w-full"
          disabled={resending}
          onClick={() => void handleResendVerification()}
        >
          {resending ? "Sending..." : "Resend verification email"}
        </Button>
      )}

      <p className="authMuted mt-4 text-center">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="authLink hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="authMuted text-sm">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
