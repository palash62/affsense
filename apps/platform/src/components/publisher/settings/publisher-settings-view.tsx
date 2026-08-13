import type { KycStatus, UserRole, UserStatus } from "@prisma/client";
import { AlertTriangle, CheckCircle, DollarSign, FileText } from "lucide-react";
import {
  DashboardCard,
  dashboardCardClassName,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import {
  avatarColors,
  formatCurrency,
  getInitials,
  KycStatusBadge,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { PublisherInfoBanner } from "@/components/publisher/publisher-info-banner";
import {
  PublisherPasswordForm,
  PublisherProfileForm,
} from "@/components/publisher/publisher-settings-panels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PublisherSettingsViewProps = {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus | null;
  rejectionReason: string;
  website: string;
  trafficSource: string;
  timezone: string;
  memberSince: string;
  totalLeads: number;
  approvedLeads: number;
  availableBalance: number;
};

function SettingsStatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof FileText;
}) {
  return (
    <div className={cn(dashboardCardClassName, "flex items-start justify-between gap-3 p-4")}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--theme-primary-soft)]">
        <Icon className="h-5 w-5 text-[var(--theme-primary)]" />
      </div>
    </div>
  );
}

export function PublisherSettingsView({
  name,
  email,
  role,
  status,
  kycStatus,
  rejectionReason,
  website,
  trafficSource,
  timezone,
  memberSince,
  totalLeads,
  approvedLeads,
  availableBalance,
}: PublisherSettingsViewProps) {
  return (
    <div className="space-y-5">
      <PublisherInfoBanner>
        Keep your profile up to date so advertisers can verify your traffic sources.
      </PublisherInfoBanner>

      {status === "SUSPENDED" && rejectionReason && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Publisher application rejected</p>
            <p className="mt-1 text-sm text-red-600">{rejectionReason}</p>
          </div>
        </div>
      )}

      <DashboardCard>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarFallback className={cn("text-lg font-semibold", avatarColors[1])}>
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-foreground">{name}</h2>
              <p className="text-sm text-muted-foreground">{email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <UserStatusBadge status={status} />
                <Badge
                  variant="outline"
                  className="border-indigo-200 bg-indigo-50 capitalize text-indigo-700"
                >
                  {role.toLowerCase()}
                </Badge>
                {kycStatus ? <KycStatusBadge status={kycStatus} /> : null}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Traffic source
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{trafficSource || "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Member since
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{memberSince}</p>
            </div>
          </div>
        </div>
      </DashboardCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SettingsStatTile label="Total Leads" value={totalLeads} icon={FileText} />
        <SettingsStatTile label="Approved Leads" value={approvedLeads} icon={CheckCircle} />
        <SettingsStatTile
          label="Available Balance"
          value={formatCurrency(availableBalance)}
          icon={DollarSign}
        />
      </div>

      <DashboardCard>
        <PublisherProfileForm
            initialName={name}
            initialWebsite={website}
            initialTrafficSource={trafficSource}
            initialTimezone={timezone}
            email={email}
        />
      </DashboardCard>

      <div id="change-password" className="scroll-mt-24">
        <DashboardCard>
          <PublisherPasswordForm />
        </DashboardCard>
      </div>
    </div>
  );
}
