export const dynamic = "force-dynamic";

import { Info, KeyRound, Plug, Shield } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { formatUserDateTime, resolveUserTimezone } from "@/lib/user-timezone";
import { getAdvertiserSettings } from "@/services/user.service";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { UserStatusBadge, avatarColors, getInitials } from "@/components/admin/admin-ui";
import {
  AdvertiserProfileForm,
  ChangePasswordForm,
} from "@/components/advertiser/advertiser-settings-panels";
import { RoleHero } from "@/components/layout/role-hero";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function AdvertiserSettingsPage() {
  const session = await getSession();
  const user = await getAdvertiserSettings(session!.user.id);

  if (!user) {
    return null;
  }

  const company = user.advertiserProfile?.company ?? "";
  const timezone = resolveUserTimezone(user.timezone);
  const memberSince = formatUserDateTime(user.createdAt, timezone, "MMM d, yyyy");

  return (
    <div className="space-y-7">
      <RoleHero
        eyebrow="Advertiser Portal"
        title="Account Settings"
        description="Manage your profile, security, and account preferences."
        action={{ label: "Change Password", href: "#change-password", icon: KeyRound }}
      />

      <div
        className="flex gap-3 rounded-xl border px-4 py-3 text-sm text-slate-700"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <p>
          Keep your profile up to date and use a strong password to protect your advertiser account.
          Email changes require support assistance.
        </p>
      </div>

      <div className="premium-card overflow-hidden">
        <div className="h-1" style={{ background: "var(--theme-gradient-revenue)" }} />
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarFallback
                className={cn("text-lg font-semibold", avatarColors[0])}
              >
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
              <p className="text-sm text-slate-500">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <UserStatusBadge status={user.status} />
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 capitalize">
                  {user.role.toLowerCase()}
                </Badge>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Company</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{company || "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Member since</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{memberSince}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GradientStatCard variant="leads" label="Account Status" value={user.status} icon={Shield} />
        <NeutralStatCard label="Referral Code" value={user.referralCode ?? "—"} icon={KeyRound} accent="purple" />
        <NeutralStatCard label="Company" value={company || "Not set"} icon={Shield} accent="green" />
      </div>

      <AdvertiserProfileForm
        initialName={user.name}
        initialCompany={company}
        initialTimezone={timezone}
        email={user.email}
      />

      <div className="premium-card overflow-hidden">
        <div className="h-1" style={{ background: "var(--theme-gradient-leads)" }} />
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Autoresponder integrations</h3>
              <p className="text-sm text-slate-500">
                Send campaign leads to Mailchimp, AWeber, GetResponse, or a custom webhook.
              </p>
            </div>
          </div>
          <Link
            href="/advertiser/integrations"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--theme-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Manage integrations
          </Link>
        </div>
      </div>

      <div id="change-password" className="scroll-mt-24">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
