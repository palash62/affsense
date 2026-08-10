"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Globe, Loader2, Save, User } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { ChangePasswordForm } from "@/components/advertiser/advertiser-settings-panels";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export { ChangePasswordForm };

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
    <PageSection
      title="Profile Information"
      description="Update your publisher profile, traffic details, and display timezone"
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

export function PublisherChangePasswordSection() {
  return (
    <div id="change-password" className="scroll-mt-24">
      <ChangePasswordForm />
    </div>
  );
}
