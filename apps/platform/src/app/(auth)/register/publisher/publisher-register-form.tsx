"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  metaUserDataFromSignup,
  trackSignupLead,
} from "@/lib/tracking/public-page-tracking";

const COUNTRY_OPTIONS = Object.keys(COUNTRY_BY_CODE).sort((a, b) =>
  getCountryName(a).localeCompare(getCountryName(b)),
);

const inputClassName = "rounded-xl border-border bg-transparent";

export function PublisherRegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [trafficSource, setTrafficSource] = useState("");
  const [country, setCountry] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    const res = await fetch("/api/v1/auth/register/publisher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        website: website.trim() || undefined,
        trafficSource: trafficSource.trim() || undefined,
        country: country || undefined,
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error?.message ?? "Registration failed");
      return;
    }

    const userId = typeof data.user?.id === "string" ? data.user.id : undefined;
    trackSignupLead({
      eventID: userId,
      contentName: "PublisherSignup",
      contentCategory: "PUBLISHER",
      userData: metaUserDataFromSignup({
        email,
        name,
        country: country || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      }),
    });

    router.push("/login?registered=publisher-verify");
  }

  return (
    <AuthLayout
      badge="Publisher"
      title="Apply as publisher"
      description="Verify your email, then we’ll review your application"
    >
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
              minLength={2}
            />
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="website">
              Website <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trafficSource">
              Traffic source <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="trafficSource"
              placeholder="Facebook, TikTok, Email..."
              value={trafficSource}
              onChange={(e) => setTrafficSource(e.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="country">
            Country <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Select value={country} onValueChange={(value) => value && setCountry(value)}>
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

        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Address <span className="font-normal normal-case tracking-normal text-muted-foreground">(optional)</span>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="addressLine1">Address</Label>
            <Input
              id="addressLine1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className={inputClassName}
              autoComplete="street-address"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClassName}
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State / Region</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className={inputClassName}
                autoComplete="address-level1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className={inputClassName}
              autoComplete="postal-code"
            />
          </div>
        </div>

        <Button type="submit" className="authPrimaryBtn h-auto" disabled={loading}>
          {loading ? "Submitting application..." : "Submit application"}
        </Button>
      </form>

      <p className="authMuted mt-4 text-center text-sm">
        Want to buy leads instead?{" "}
        <Link href="/register" className="authLink hover:underline">
          Register as advertiser
        </Link>
      </p>
      <p className="authMuted mt-2 text-center">
        Already have an account?{" "}
        <Link href="/login" className="authLink hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
