"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Banknote, Clock, ClipboardList, MousePointer2, ShoppingCart } from "lucide-react";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import {
  PublisherBalanceCard,
  PublisherKpiCard,
} from "@/components/publisher/affsense-dashboard/publisher-kpi-card";
import { EarningsClicksOverview } from "@/components/publisher/affsense-dashboard/earnings-clicks-overview";
import { PublisherQuickActions } from "@/components/publisher/affsense-dashboard/publisher-quick-actions";
import {
  TopPerformingOffers,
  type TopOfferRow,
} from "@/components/publisher/affsense-dashboard/top-performing-offers";
import {
  RecentConversions,
  type RecentConversionRow,
} from "@/components/publisher/affsense-dashboard/recent-conversions";
import {
  ReferralsOverview,
  type ReferralsOverviewData,
} from "@/components/publisher/affsense-dashboard/referrals-overview";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";
import { PUBLISHER_GET_PAID_TASKS_ENABLED } from "@/lib/feature-flags";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";

export type AffsensePublisherDashboardData = {
  period: string;
  source: string;
  cards: {
    clicks: number;
    clicksTrend: number;
    conversions: number;
    conversionsTrend: number;
    earnings: number;
    earningsTrend: number;
    pendingEarnings: number;
    availableBalance: number;
    series: Array<{ date: string; clicks: number; conversions: number; earnings: number }>;
  };
  topOffers: TopOfferRow[];
  recentConversions: RecentConversionRow[];
  referrals: ReferralsOverviewData;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    iconKey: string | null;
    tone: "VIOLET" | "EMERALD" | "BLUE" | "AMBER";
    publishedAt: string;
  }>;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const PERIOD_TABS = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
] as const;

const SOURCE_TABS = [
  { id: "all", label: "All" },
  { id: "digital", label: "Digital" },
  { id: "cpa", label: "CPA" },
  { id: "offerwall", label: "Offer Wall" },
  ...(PUBLISHER_GET_PAID_TASKS_ENABLED ? [{ id: "tasks", label: "Get Paid Tasks" } as const] : []),
];

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  all: "all sources",
  digital: "digital products",
  cpa: "CPA offers",
  offerwall: "the offer wall",
  tasks: "get paid tasks",
};

const PERIOD_DESCRIPTIONS: Record<string, string> = {
  "7d": "the last 7 days",
  "30d": "the last 30 days",
  month: "this month",
  year: "this year",
};

function FilterTabs({
  tabs,
  activeId,
  hrefFor,
}: {
  tabs: ReadonlyArray<{ id: string; label: string }>;
  activeId: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <div className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={hrefFor(tab.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            activeId === tab.id
              ? "bg-[var(--theme-primary)] text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export function AffsensePublisherDashboard({ data }: { data: AffsensePublisherDashboardData }) {
  const { cards } = data;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePeriod = data.period;
  const isTasks = data.source === "tasks";

  const hrefWith = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`Clicks, conversions, and earnings from ${
          SOURCE_DESCRIPTIONS[data.source] ?? "all sources"
        } for ${PERIOD_DESCRIPTIONS[activePeriod] ?? "the selected period"}.`}
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "Dashboard" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          tabs={SOURCE_TABS}
          activeId={data.source}
          hrefFor={(id) => hrefWith("source", id)}
        />
        <FilterTabs
          tabs={PERIOD_TABS}
          activeId={activePeriod}
          hrefFor={(id) => hrefWith("period", id)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <PublisherKpiCard
          label={isTasks ? "Total Submissions" : "Total Clicks"}
          value={cards.clicks.toLocaleString("en-US")}
          trend={cards.clicksTrend}
          icon={isTasks ? ClipboardList : MousePointer2}
          accent="coral"
          sparkline={cards.series.map((p) => p.clicks)}
        />
        <PublisherKpiCard
          label="Total Conversions"
          value={cards.conversions.toLocaleString("en-US")}
          trend={cards.conversionsTrend}
          icon={ShoppingCart}
          accent="coral"
          sparkline={cards.series.map((p) => p.conversions)}
        />
        <PublisherKpiCard
          label="Total Earnings"
          value={formatMoney(cards.earnings)}
          trend={cards.earningsTrend}
          icon={Banknote}
          accent="emerald"
          sparkline={cards.series.map((p) => p.earnings)}
        />
        <PublisherKpiCard
          label="Pending Earnings"
          value={formatMoney(cards.pendingEarnings)}
          icon={Clock}
          accent="amber"
          note="Will be available soon"
          sparkline={cards.series.map((p) => p.earnings)}
        />
        <PublisherBalanceCard amount={formatMoney(cards.availableBalance)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <EarningsClicksOverview series={cards.series} period={activePeriod} />
        </div>
        <div className="xl:col-span-5">
          <PublisherQuickActions />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <TopPerformingOffers rows={data.topOffers} />
        </div>
        <div className="xl:col-span-4">
          <RecentConversions rows={data.recentConversions} source={data.source} />
        </div>
        <div className="xl:col-span-3">
          <ReferralsOverview data={data.referrals} />
        </div>
      </div>

      <DashboardCard>
        <div className="flex items-start justify-between gap-2">
          <DashboardCardTitle>Announcements</DashboardCardTitle>
          <ButtonLink
            href="/publisher/announcements"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
          >
            View all
          </ButtonLink>
        </div>
        <div className="mt-4">
          <AnnouncementsFeed
            items={data.announcements}
            emptyLabel="No announcements right now."
          />
        </div>
      </DashboardCard>
    </div>
  );
}
