"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthLayout } from "@/components/layout/auth-layout";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { isStrongPassword } from "@/lib/password-policy";
import { COUNTRY_BY_CODE, getCountryName } from "@/lib/campaign-form";
import { readReferralCookie, writeReferralCookie } from "@/lib/referral";
import {
  clearPromoUtmCookie,
  mergePromotionAttribution,
  readPromoUtmCookie,
  readPromotionAttributionFromUrl,
  type PromotionAttributionPayload,
} from "@/lib/promotion-attribution";
import { PromotionAttributionCapture } from "@/modules/marketing/components/promotion-attribution-capture";
import {
  metaUserDataFromSignup,
  trackSignupLead,
} from "@/lib/tracking/public-page-tracking";

const COUNTRY_OPTIONS = Object.keys(COUNTRY_BY_CODE).sort((a, b) =>
  getCountryName(a).localeCompare(getCountryName(b)),
);

const inputClassName = "rounded-xl border-border bg-transparent";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [referralRef, setReferralRef] = useState("");
  const [signupAttribution, setSignupAttribution] = useState<
    Partial<PromotionAttributionPayload> | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("referral_by") ?? searchParams.get("ref") ?? "";
    const ref = fromUrl.trim() || readReferralCookie();
    if (fromUrl.trim()) {
      writeReferralCookie(fromUrl.trim());
    }
    setReferralRef(ref);

    const merged = mergePromotionAttribution(
      readPromotionAttributionFromUrl(searchParams.toString() ? `?${searchParams.toString()}` : ""),
      readPromoUtmCookie(),
    );
    if (merged.utmSource && merged.utmCampaign) {
      setSignupAttribution({
        ...merged,
        landingPath: typeof window !== "undefined" ? window.location.pathname : undefined,
        landingUrl: typeof window !== "undefined" ? window.location.href : undefined,
      });
    }
  }, [searchParams]);

  const isReferralSignup = Boolean(referralRef.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isStrongPassword(password)) {
      setError(
        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.",
      );
      return;
    }

    setLoading(true);

    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        address,
        country,
        password,
        role: "ADVERTISER",
        referralRef,
        ...(signupAttribution ? { signupAttribution } : {}),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error?.message ?? "Registration failed");
      return;
    }

    clearPromoUtmCookie();

    const userId = typeof data.user?.id === "string" ? data.user.id : undefined;
    trackSignupLead({
      eventID: userId,
      contentName: "AdvertiserSignup",
      contentCategory: "ADVERTISER",
      userData: metaUserDataFromSignup({
        email,
        phone,
        name,
        country,
      }),
    });

    router.push("/login?registered=verify");
  }

  return (
    <>
      <PromotionAttributionCapture />
      <AuthLayout
      badge="Advertiser"
      title="Create your account"
      description={
        isReferralSignup
          ? "You were referred to join as an advertiser on Affsense"
          : "Buy verified leads with pay-per-lead campaigns"
      }
    >
      {isReferralSignup && (
        <div className="authReferral">
          You were invited with referral code <strong>{referralRef.toUpperCase()}</strong>.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClassName}
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClassName}
              autoComplete="tel"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClassName}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClassName}
            autoComplete="street-address"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Select value={country} onValueChange={(value) => value && setCountry(value)} required>
            <SelectTrigger id="country" className={`w-full ${inputClassName}`}>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((code) => (
                <SelectItem key={code} value={code}>
                  {getCountryName(code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            className={inputClassName}
            required
          />
          {password.length > 0 && <PasswordRequirements password={password} />}
        </div>

        <Button type="submit" className="authPrimaryBtn h-auto" disabled={loading || !country}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="authMuted mt-4 text-center">
        Already have an account?{" "}
        <Link href="/login" className="authLink hover:underline">
          Sign in
        </Link>
      </p>
      <p className="authMuted mt-2 text-center text-sm">
        Want to publish leads?{" "}
        <Link href="/register/publisher" className="authLink hover:underline">
          Apply as publisher
        </Link>
      </p>
    </AuthLayout>
    </>
  );
}
