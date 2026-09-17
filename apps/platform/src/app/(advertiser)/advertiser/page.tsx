export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { DollarSign, FileText, Megaphone, MousePointer, Wallet } from "lucide-react";
import { getSession } from "@/lib/session";
import { canAdvertiserAccessAutoresponder } from "@/lib/autoresponder-access";
import { ADVERTISER_PERIODS, parseAdvertiserPeriod } from "@/lib/advertiser-periods";
import { ensureReferralCode } from "@/services/referral.service";
import { getAdvertiserDashboardData } from "@/services/report.service";
import { listAdvertiserDashboardAlerts } from "@/services/notification.service";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { formatCurrency } from "@/components/admin/admin-ui";
import { AdvertiserPeriodFilter } from "@/components/advertiser/advertiser-period-filter";
import { AdvertiserReferralCard } from "@/components/advertiser/advertiser-referral-card";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { AffsenseStatCard } from "@/components/dashboard/affsense-stat-card";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import { AdvertiserDashboardAlerts } from "@/components/advertiser/advertiser-dashboard-alerts";
import { AutoresponderAnnouncementBanner } from "@/components/advertiser/autoresponder-announcement-banner";
import {
  AdvertiserPendingQueue,
  AdvertiserSummaryTable,
} from "@/components/advertiser/advertiser-dashboard-panels";
import { LeadsTrendChart } from "@/components/dashboard/dashboard-charts";
import { PageHeader } from "@/components/layout/page-header";
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
  const showAutoresponderAnnouncement = canAdvertiserAccessAutoresponder(session?.user?.email);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`Campaign performance for ${periodLabel.toLowerCase()}.`}
        breadcrumbs={[
          { label: "Advertiser", href: "/advertiser" },
          { label: "Dashboard" },
        ]}
      >
        <Suspense fallback={<div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />}>
          <AdvertiserPeriodFilter current={period} />
        </Suspense>
        <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card px-4 py-2 shadow-[var(--shadow-card)]">
          <p className="text-xs font-medium tracking-normal text-muted-foreground">Wallet</p>
          <p className="text-lg font-bold tracking-normal text-foreground">
            {formatCurrency(data.walletBalance)}
          </p>
        </div>
        <ButtonLink
          href="/advertiser/campaigns/new"
          className="h-9 rounded-lg bg-[var(--theme-primary)] px-4 text-sm hover:opacity-90"
        >
          <Megaphone className="mr-1.5 h-4 w-4" />
          Create Campaign
        </ButtonLink>
        <ButtonLink
          href="/advertiser/wallet"
          variant="outline"
          className="h-9 rounded-lg px-4 text-sm"
        >
          <Wallet className="mr-1.5 h-4 w-4" />
          Add Funds
        </ButtonLink>
      </PageHeader>

      {showAutoresponderAnnouncement ? <AutoresponderAnnouncementBanner /> : null}
      <AdvertiserDashboardAlerts alerts={alerts} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AffsenseStatCard
          label="Active Campaigns"
          value={String(data.activeCampaigns)}
          icon={Megaphone}
          accent="coral"
          footer={{ href: "/advertiser/campaigns", linkLabel: "View campaigns" }}
        />
        <AffsenseStatCard
          label="Approved Leads"
          value={data.stats.leads.toLocaleString("en-US")}
          icon={FileText}
          trend={data.stats.leadsTrend}
          accent="emerald"
          footer={{ href: "/advertiser/leads", linkLabel: "View leads" }}
        />
        <AffsenseStatCard
          label="Clicks"
          value={data.stats.clicks.toLocaleString("en-US")}
          icon={MousePointer}
          trend={data.stats.clicksTrend}
          accent="amber"
        />
        <AffsenseStatCard
          label="CPL"
          value={formatCurrency(data.stats.cpl)}
          icon={DollarSign}
          trend={data.stats.cplTrend}
          accent="navy"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <AdvertiserSummaryTable rows={data.summaryRows} />
          <DashboardCard className="h-full">
            <DashboardCardTitle>Leads Over Time</DashboardCardTitle>
            <DashboardCardDescription>
              Daily approved lead volume — last 30 days
            </DashboardCardDescription>
            <div className="mt-4">
              {data.leadsTrend.length > 0 ? (
                <LeadsTrendChart title="Leads Over Time" data={data.leadsTrend} embedded />
              ) : (
                <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                  No lead data for this period yet
                </div>
              )}
            </div>
          </DashboardCard>
          <AdvertiserPendingQueue leads={data.pendingLeads} />
        </div>
        <aside className="space-y-4 xl:col-span-4">
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
