export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { DollarSign, FileText, LineChart, Megaphone, Wallet } from "lucide-react";
import { getSession } from "@/lib/session";
import { canAdvertiserAccessAutoresponder } from "@/lib/autoresponder-access";
import { ADVERTISER_PERIODS, parseAdvertiserPeriod } from "@/lib/advertiser-periods";
import { ensureReferralCode } from "@/services/referral.service";
import { getAdvertiserDashboardData } from "@/services/report.service";
import { listAdvertiserDashboardAlerts } from "@/services/notification.service";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { PageSection } from "@/components/admin/page-section";
import { formatCurrency } from "@/components/admin/admin-ui";
import { RoleHero } from "@/components/layout/role-hero";
import { AdvertiserPeriodFilter } from "@/components/advertiser/advertiser-period-filter";
import { AdvertiserReferralCard } from "@/components/advertiser/advertiser-referral-card";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import { AdvertiserDashboardAlerts } from "@/components/advertiser/advertiser-dashboard-alerts";
import { AutoresponderAnnouncementBanner } from "@/components/advertiser/autoresponder-announcement-banner";
import {
  AdvertiserPendingQueue,
  AdvertiserSummaryTable,
} from "@/components/advertiser/advertiser-dashboard-panels";
import { LeadsTrendChart } from "@/components/dashboard/dashboard-charts";
import { ButtonLink } from "@/components/ui/button-link";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdvertiserDashboardPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const period = parseAdvertiserPeriod(params.period);
  const periodLabel = ADVERTISER_PERIODS.find((p) => p.value === period)?.label ?? "Last 30 Days";
  const userId = session!.user.id;

  const [data, referralCode, alerts, announcements] = await Promise.all([
    getAdvertiserDashboardData(userId, period),
    ensureReferralCode(userId),
    listAdvertiserDashboardAlerts(userId),
    listPublishedAnnouncements("ADVERTISER", 6),
  ]);
  const firstName = session?.user?.name?.split(" ")[0] ?? "Advertiser";
  const showAutoresponderAnnouncement = canAdvertiserAccessAutoresponder(session?.user?.email);

  return (
    <div className="space-y-5">
      <RoleHero
        eyebrow="Advertiser Portal"
        title={`Hello, ${session?.user?.name ?? firstName}!`}
        description={`Campaign performance for ${periodLabel.toLowerCase()}.`}
        action={{ label: "Create Campaign", href: "/advertiser/campaigns/new", icon: Megaphone }}
      />

      {showAutoresponderAnnouncement ? <AutoresponderAnnouncementBanner /> : null}

      <AdvertiserDashboardAlerts alerts={alerts} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Suspense fallback={<div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />}>
          <AdvertiserPeriodFilter current={period} />
        </Suspense>
        <div className="flex items-center gap-3">
          <div className="rounded-[18px] border border-border border-t-[3px] border-t-emerald-500 bg-card px-5 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Wallet Balance</p>
            <p className="text-xl font-bold tracking-tight text-[var(--theme-primary)]">
              {formatCurrency(data.walletBalance)}
            </p>
          </div>
          <ButtonLink
            href="/advertiser/wallet"
            className="h-9 rounded-lg bg-[var(--theme-primary)] px-4 text-sm hover:opacity-90"
          >
            <Wallet className="mr-1.5 h-4 w-4" />
            Add Funds
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NeutralStatCard
          label="Active Campaigns"
          value={data.activeCampaigns}
          icon={Megaphone}
          accent="green"
        />
        <GradientStatCard
          variant="leads"
          label="Approved Leads"
          value={data.stats.leads}
          icon={FileText}
          trend={data.stats.leadsTrend}
        />
        <GradientStatCard
          variant="revenue"
          label="CPL"
          value={formatCurrency(data.stats.cpl)}
          icon={DollarSign}
          trend={data.stats.cplTrend}
        />
        <NeutralStatCard
          label="Spent"
          value={formatCurrency(data.stats.spent)}
          icon={Wallet}
          accent="orange"
          trend={data.stats.spentTrend}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <AdvertiserSummaryTable rows={data.summaryRows} />

          {data.leadsTrend.length > 0 && (
            <PageSection
              title="Leads Over Time"
              description="Daily lead volume for the last 30 days"
              icon={LineChart}
              gradient="leads"
              contentClassName="px-6 py-5"
            >
              <LeadsTrendChart title="Leads Over Time" data={data.leadsTrend} embedded />
            </PageSection>
          )}

          <AdvertiserPendingQueue leads={data.pendingLeads} />
        </div>

        <aside className="space-y-4">
          <AdvertiserReferralCard referralCode={referralCode} />
          <DashboardCard>
            <DashboardCardTitle>Announcements</DashboardCardTitle>
            <div className="mt-4">
              <AnnouncementsFeed
                items={announcements}
                emptyLabel="No announcements right now."
              />
            </div>
          </DashboardCard>
        </aside>
      </div>
    </div>
  );
}
