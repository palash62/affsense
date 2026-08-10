export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle, DollarSign, FileText, KeyRound } from "lucide-react";
import { getSession } from "@/lib/session";
import { formatUserDateTime, resolveUserTimezone } from "@/lib/user-timezone";
import { getPublisherSettings } from "@/services/user.service";
import { prisma } from "@/lib/prisma";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import {
  avatarColors,
  formatCurrency,
  getInitials,
  KycStatusBadge,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { RoleHero } from "@/components/layout/role-hero";
import { PublisherInfoBanner } from "@/components/publisher/publisher-info-banner";
import {
  PublisherChangePasswordSection,
  PublisherProfileForm,
} from "@/components/publisher/publisher-settings-panels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function PublisherSettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const user = await getPublisherSettings(session.user.id);

  if (!user) {
    return null;
  }

  const approvedLeads = await prisma.lead.count({
    where: { publisherId: user.id, status: { in: ["APPROVED", "PAID"] } },
  });

  const website = user.publisherProfile?.website ?? "";
  const trafficSource = user.publisherProfile?.trafficSource ?? "";
  const rejectionReason = user.publisherProfile?.rejectionReason ?? "";
  const timezone = resolveUserTimezone(user.timezone);
  const memberSince = formatUserDateTime(user.createdAt, timezone, "MMM d, yyyy");
  const availableBalance = user.wallet
    ? Number(user.wallet.balance)
    : 0;

  return (
    <div className="space-y-7">
      <RoleHero
        eyebrow="Publisher Portal"
        title="Account Settings"
        description="Manage your profile, traffic details, and account security."
        action={{ label: "Change Password", href: "#change-password", icon: KeyRound }}
      />

      <PublisherInfoBanner>
        Keep your profile up to date so advertisers can verify your traffic sources. Email changes
        require support assistance.
      </PublisherInfoBanner>

      {user.status === "SUSPENDED" && rejectionReason && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Publisher application rejected</p>
            <p className="mt-1 text-sm text-red-600">{rejectionReason}</p>
          </div>
        </div>
      )}

      <div className="premium-card overflow-hidden">
        <div className="h-1" style={{ background: "var(--theme-gradient-leads)" }} />
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarFallback className={cn("text-lg font-semibold", avatarColors[1])}>
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <UserStatusBadge status={user.status} />
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 capitalize">
                  {user.role.toLowerCase()}
                </Badge>
                {user.publisherProfile && (
                  <KycStatusBadge status={user.publisherProfile.kycStatus} />
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Traffic source</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{trafficSource || "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Member since</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{memberSince}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NeutralStatCard label="Total Leads" value={user._count.leads} icon={FileText} accent="purple" />
        <GradientStatCard variant="approved" label="Approved Leads" value={approvedLeads} icon={CheckCircle} />
        <GradientStatCard
          variant="revenue"
          label="Available Balance"
          value={formatCurrency(availableBalance)}
          icon={DollarSign}
        />
      </div>

      <PublisherProfileForm
        initialName={user.name}
        initialWebsite={website}
        initialTrafficSource={trafficSource}
        initialTimezone={timezone}
        email={user.email}
      />

      <PublisherChangePasswordSection />
    </div>
  );
}
