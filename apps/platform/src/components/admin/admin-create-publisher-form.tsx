"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Loader2,
  MailPlus,
  MapPin,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AdminCreatePublisherForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [trafficSource, setTrafficSource] = useState("");
  const [country, setCountry] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setTempPassword(null);
    setCopied(false);

    const res = await fetch("/api/v1/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        website: website.trim() || undefined,
        trafficSource: trafficSource.trim() || undefined,
        country: country.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        status,
      }),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to create publisher");
      return;
    }

    setSuccess("Publisher account created. They will receive login credentials and a verification email.");
    setTempPassword(data?.data?.tempPassword ?? null);
    router.refresh();
    setName("");
    setEmail("");
    setWebsite("");
    setTrafficSource("");
    setCountry("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setState("");
    setPostalCode("");
    setStatus("ACTIVE");
  }

  async function copyPassword() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}
      {tempPassword && (
        <div className="rounded-lg border border-border bg-muted px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Temporary password
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-card px-3 py-1 text-sm font-semibold text-foreground shadow-sm">
              {tempPassword}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={copyPassword} className="gap-1">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Share this password with the publisher. They should update it after logging in.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Publisher details
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="publisher-name">Full name</Label>
            <Input
              id="publisher-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publisher-email">Email</Label>
            <div className="relative">
              <MailPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="publisher-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="publisher-website">Website</Label>
            <Input
              id="publisher-website"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publisher-traffic">Traffic source</Label>
            <Input
              id="publisher-traffic"
              placeholder="Facebook, TikTok, Email..."
              value={trafficSource}
              onChange={(e) => setTrafficSource(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-4 w-4 text-[var(--theme-primary)]" />
          Address details
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="publisher-country">Country</Label>
            <Input
              id="publisher-country"
              placeholder="United States"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publisher-city">City</Label>
            <Input
              id="publisher-city"
              placeholder="Los Angeles"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="publisher-address-1">Address line 1</Label>
          <Input
            id="publisher-address-1"
            placeholder="Street address"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="publisher-address-2">Address line 2</Label>
          <Input
            id="publisher-address-2"
            placeholder="Apartment, suite, etc."
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="publisher-state">State / Region</Label>
            <Input
              id="publisher-state"
              placeholder="California"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publisher-postal">Postal code</Label>
            <Input
              id="publisher-postal"
              placeholder="90001"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="publisher-status">Status</Label>
        <select
          id="publisher-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={cn(
            "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none",
            "focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15",
          )}
        >
          <option value="PENDING">Pending (verify email, then admin approval)</option>
          <option value="ACTIVE">Active (skip approval)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Publishers must verify their email. Pending accounts still need admin approval before they can sign in.
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {loading ? "Creating..." : "Create Publisher"}
      </Button>
    </form>
  );
}
