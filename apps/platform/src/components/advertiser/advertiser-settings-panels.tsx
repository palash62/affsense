"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Building2, KeyRound, Loader2, Save, User } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isStrongPassword } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

export function AdvertiserProfileForm({
  initialName,
  initialCompany,
  initialTimezone,
  email,
}: {
  initialName: string;
  initialCompany: string;
  initialTimezone: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [company, setCompany] = useState(initialCompany);
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
        company: company.trim(),
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
    <PageSection
      title="Profile Information"
      description="Update your name, company, and display timezone"
      icon={User}
      gradient="leads"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
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
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-company">Company</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="profile-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="pl-9"
                required
                minLength={2}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} disabled className="bg-muted text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Email cannot be changed here. Contact support if needed.</p>
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
    </PageSection>
  );
}

export function ChangePasswordForm() {
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
    <PageSection
      title="Change Password"
      description="Update your account password"
      icon={KeyRound}
      gradient="approved"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
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
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
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
    </PageSection>
  );
}
