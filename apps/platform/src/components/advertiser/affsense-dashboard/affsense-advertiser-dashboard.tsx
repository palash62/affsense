"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DollarSign, MousePointer, Plus, Store, CheckCircle2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { AffsenseStatCard } from "@/components/dashboard/affsense-stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import { AdvertiserReferralCard } from "@/components/advertiser/advertiser-referral-card";
import { CpaOfferStatusDot, CpaOfferThumb } from "@/components/cpa/cpa-offer-thumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AffsenseAdvertiserDashboardData = {
  period: string;
  walletBalance: number;
  referralCode: string;
  kpis: {
    activeOffers: number;
    totalOffers: number;
    clicks: number;
    clicksTrend: number;
    conversions: number;
    conversionsTrend: number;
    payoutSpend: number;
    payoutSpendTrend: number;
  };
  series: Array<{
    date: string;
    label: string;
    clicks: number;
    conversions: number;
  }>;
  myOffers: Array<{
    id: string;
    name: string;
    status: string;
    thumbnailUrl: string | null;
    category: string;
    payout: number;
    payoutModel: string;
  }>;
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

export function AffsenseAdvertiserDashboard({ data }: { data: AffsenseAdvertiserDashboardData }) {
  const { kpis } = data;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePeriod = data.period;
  const hasSeries = data.series.some((d) => d.clicks > 0 || d.conversions > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="CPA offer performance for the selected period."
        breadcrumbs={[
          { label: "Advertiser", href: "/advertiser" },
          { label: "Dashboard" },
        ]}
      >
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {PERIOD_TABS.map((tab) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("period", tab.id);
            const href = `${pathname}?${params.toString()}`;
            const active = activePeriod === tab.id;
            return (
              <Link
                key={tab.id}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-[var(--theme-primary)] text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card px-4 py-2 shadow-[var(--shadow-card)]">
          <p className="text-xs font-medium tracking-normal text-muted-foreground">Wallet</p>
          <p className="text-lg font-bold tracking-normal text-foreground">
            {formatMoney(data.walletBalance)}
          </p>
        </div>
        <ButtonLink
          href="/advertiser/cpa-offers/new"
          className="h-9 rounded-lg bg-[var(--theme-primary)] px-4 text-sm hover:opacity-90"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add New Offer
        </ButtonLink>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AffsenseStatCard
          label="My Offers"
          value={String(kpis.activeOffers)}
          icon={Store}
          accent="coral"
          footer={{ href: "/advertiser/cpa-offers", linkLabel: "View offers" }}
        />
        <AffsenseStatCard
          label="Clicks"
          value={kpis.clicks.toLocaleString("en-US")}
          trend={kpis.clicksTrend}
          icon={MousePointer}
          accent="amber"
          footer={{ href: "/advertiser/cpa-offers/report", linkLabel: "View report" }}
        />
        <AffsenseStatCard
          label="Conversions"
          value={kpis.conversions.toLocaleString("en-US")}
          trend={kpis.conversionsTrend}
          icon={CheckCircle2}
          accent="emerald"
          footer={{ href: "/advertiser/cpa-offers/report", linkLabel: "View report" }}
        />
        <AffsenseStatCard
          label="Payout Spend"
          value={formatMoney(kpis.payoutSpend)}
          trend={kpis.payoutSpendTrend}
          icon={DollarSign}
          accent="navy"
          footer={{ href: "/advertiser/cpa-offers/report-log", linkLabel: "Report log" }}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <DashboardCard>
            <DashboardCardTitle>Performance Overview</DashboardCardTitle>
            <DashboardCardDescription>
              Daily clicks and conversions on your offers
            </DashboardCardDescription>
            <div className="mt-4 min-h-[260px]">
              {hasSeries ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="clicks"
                      name="Clicks"
                      stroke="var(--theme-primary)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="conversions"
                      name="Conversions"
                      stroke="var(--theme-success)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                  No traffic on your offers in this period yet
                </div>
              )}
            </div>
          </DashboardCard>

          <DashboardCard>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DashboardCardTitle>My Offers</DashboardCardTitle>
                <DashboardCardDescription>
                  {kpis.totalOffers} total · {kpis.activeOffers} active
                </DashboardCardDescription>
              </div>
              <ButtonLink
                href="/advertiser/cpa-offers"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
              >
                View all
              </ButtonLink>
            </div>
            <div className="mt-4 overflow-x-auto">
              {data.myOffers.length === 0 ? (
                <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <p>No offers yet. Create your first CPA offer.</p>
                  <ButtonLink href="/advertiser/cpa-offers/new" size="sm">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add New Offer
                  </ButtonLink>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Offer</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.myOffers.map((offer) => (
                      <TableRow key={offer.id}>
                        <TableCell>
                          <Link
                            href={`/advertiser/cpa-offers/${offer.id}`}
                            className="flex items-center gap-3 font-medium text-foreground hover:text-[var(--theme-primary)]"
                          >
                            <CpaOfferThumb
                              name={offer.name}
                              thumbnailUrl={offer.thumbnailUrl}
                              size="sm"
                            />
                            <span className="line-clamp-1">{offer.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{offer.category}</TableCell>
                        <TableCell>
                          {formatMoney(offer.payout)}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {offer.payoutModel}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                            <CpaOfferStatusDot status={offer.status} />
                            {offer.status.toLowerCase()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DashboardCard>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <AdvertiserReferralCard referralCode={data.referralCode} />
          <DashboardCard>
            <DashboardCardTitle>Announcements</DashboardCardTitle>
            <div className="mt-4">
              <AnnouncementsFeed
                items={data.announcements}
                emptyLabel="No announcements right now."
              />
            </div>
          </DashboardCard>
        </aside>
      </div>
    </div>
  );
}
