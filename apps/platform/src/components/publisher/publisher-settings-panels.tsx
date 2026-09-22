"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Banknote, Globe, KeyRound, Loader2, Save } from "lucide-react";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import {
  EMPTY_BANK_DETAILS,
  PublisherBankPayoutFields,
} from "@/components/publisher/publisher-bank-payout-fields";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BankPayoutDetails } from "@/lib/payout-payment-details";
import { isStrongPassword } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

export function PublisherProfileForm({
  initialName,
  initialWebsite,
  initialTrafficSource,
  initialTimezone,
  email,
}: {
  initialName: string;
  initialWebsite: string;
  initialTrafficSource: string;
  initialTimezone: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [website, setWebsite] = useState(initialWebsite);
  const [trafficSource, setTrafficSource] = useState(initialTrafficSource);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { update } = useSession();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/v1/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        website: website.trim() || undefined,
        trafficSource: trafficSource.trim() || undefined,
        timezone,
      }),
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to update profile");
      return;
    }

    await update?.({ timezone, name: name.trim() });
    setSuccess("Profile updated successfully.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="grid gap-4 md:grid-cols-2">
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
          <Label htmlFor="publisher-website">Website</Label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="publisher-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="pl-9"
              placeholder="https://yoursite.com"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="publisher-traffic">Traffic source</Label>
        <Input
          id="publisher-traffic"
          value={trafficSource}
          onChange={(e) => setTrafficSource(e.target.value)}
          placeholder="e.g. SEO, Paid Ads, Social Media"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="publisher-email">Email</Label>
        <Input id="publisher-email" value={email} disabled className="bg-muted text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed here. Contact support if needed.
        </p>
      </div>

      <TimezoneSelect value={timezone} onChange={setTimezone} disabled={saving} />

      <Button
        type="submit"
        disabled={saving}
        className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}

export function PublisherPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isStrongPassword(newPassword)) {
      setError(
        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to change password");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("Password changed successfully.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="space-y-2">
        <Label htmlFor="publisher-current-password">Current password</Label>
        <Input
          id="publisher-current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="publisher-new-password">New password</Label>
          <Input
            id="publisher-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="publisher-confirm-password">Confirm new password</Label>
          <Input
            id="publisher-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
      </div>

      <PasswordRequirements password={newPassword} />

      <Button
        type="submit"
        disabled={saving}
        className={cn("h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90")}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {saving ? "Updating..." : "Change Password"}
      </Button>
    </form>
  );
}

function isBankDetailsRecord(value: unknown): value is BankPayoutDetails {
  return (
    !!value &&
    typeof value === "object" &&
    "beneficiaryName" in value &&
    "accountNumber" in value &&
    "country" in value
  );
}

export function PublisherPayoutDetailsForm({
  name,
  website,
  trafficSource,
  timezone,
  initialWiseId,
  initialBankDetails,
  initialDefaultMethod,
}: {
  name: string;
  website: string;
  trafficSource: string;
  timezone: string;
  initialWiseId: string;
  initialBankDetails: BankPayoutDetails | null;
  initialDefaultMethod: "WISE" | "BANK_TRANSFER" | null;
}) {
  const [wiseId, setWiseId] = useState(initialWiseId);
  const [bankDetails, setBankDetails] = useState<BankPayoutDetails>(
    initialBankDetails ?? EMPTY_BANK_DETAILS,
  );
  const [defaultMethod, setDefaultMethod] = useState<"WISE" | "BANK_TRANSFER" | "">(
    initialDefaultMethod ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const hasBank =
      Boolean(bankDetails.beneficiaryName?.trim()) ||
      Boolean(bankDetails.accountNumber?.trim()) ||
      Boolean(bankDetails.country?.trim());

    const res = await fetch("/api/v1/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        website: website || undefined,
        trafficSource: trafficSource || undefined,
        timezone,
        updatePayoutDetails: true,
        payoutWiseId: wiseId.trim() || null,
        payoutBankDetails: hasBank ? bankDetails : null,
        defaultPayoutMethod: defaultMethod || null,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to save payout details");
      return;
    }

    setSuccess("Payout details saved. Your default method will appear on new invoices.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2">
        <Banknote className="h-4 w-4 text-[var(--theme-primary)]" />
        <h3 className="text-sm font-semibold text-foreground">Invoice payout details</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Set Wise and/or bank details for weekly invoices. Choose one default — that account is
        shown on each new invoice for admin payment.
      </p>

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

      <div className="space-y-2">
        <Label htmlFor="publisher-wise-id">Wise ID / email</Label>
        <Input
          id="publisher-wise-id"
          type="email"
          value={wiseId}
          onChange={(e) => setWiseId(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <PublisherBankPayoutFields value={bankDetails} onChange={setBankDetails} />

      <div className="space-y-2">
        <Label>Default for invoices</Label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="defaultPayoutMethod"
              checked={defaultMethod === "WISE"}
              onChange={() => setDefaultMethod("WISE")}
            />
            Wise
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="defaultPayoutMethod"
              checked={defaultMethod === "BANK_TRANSFER"}
              onChange={() => setDefaultMethod("BANK_TRANSFER")}
            />
            Bank transfer
          </label>
        </div>
      </div>

      <Button
        type="submit"
        disabled={saving}
        className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving..." : "Save payout details"}
      </Button>
    </form>
  );
}

export { isBankDetailsRecord };
