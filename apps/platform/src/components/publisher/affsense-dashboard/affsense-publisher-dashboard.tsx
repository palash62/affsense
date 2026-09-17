"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MousePointer, Percent, FileText, DollarSign } from "lucide-react";
import {
  CartesianGrid,
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
import { LeadStatusBadge } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";

export type AffsensePublisherDashboardData = {
  period: string;
  availableBalance: number;
  kpis: {
    clicks: number;
    clicksTrend: number;
    totalLeads: number;
    leadsTrend: number;
    conversionRate: number;
    conversionTrend: number;
    earnings: number;
    earningsTrend: number;
  };
  earningsChart: Array<{ date: string; label: string; amount: number }>;
  recentLeads: Array<{
    id: string;
    status: string;
    createdAt: string;
    payoutLabel: string;
    payoutClassName: string;
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

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const PERIOD_TABS = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
] as const;

export function AffsensePublisherDashboard({ data }: { data: AffsensePublisherDashboardData }) {
  const { kpis } = data;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePeriod = data.period;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Clicks, leads, and earnings for the selected period."
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "Dashboard" },
        ]}
      >
        <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card px-4 py-2 shadow-[var(--shadow-card)]">
          <p className="text-xs font-medium tracking-normal text-muted-foreground">
            Available Balance
          </p>
          <p className="text-lg font-bold tracking-normal text-foreground">
            {formatMoney(data.availableBalance)}
          </p>
        </div>
        <ButtonLink
          href="/publisher/payouts/request"
          className="h-9 rounded-lg bg-[var(--theme-primary)] px-4 text-sm hover:opacity-90"
        >
          Request Payout
        </ButtonLink>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AffsenseStatCard
          label="Clicks"
          value={kpis.clicks.toLocaleString("en-US")}
          trend={kpis.clicksTrend}
          icon={MousePointer}
          accent="coral"
        />
        <AffsenseStatCard
          label="Leads"
          value={kpis.totalLeads.toLocaleString("en-US")}
          trend={kpis.leadsTrend}
          icon={FileText}
          accent="emerald"
          footer={{ href: "/publisher/leads", linkLabel: "View leads" }}
        />
        <AffsenseStatCard
          label="Conversion"
          value={`${kpis.conversionRate.toFixed(1)}%`}
          trend={kpis.conversionTrend}
          icon={Percent}
          accent="amber"
        />
        <AffsenseStatCard
          label="Earnings"
          value={formatMoney(kpis.earnings)}
          trend={kpis.earningsTrend}
          icon={DollarSign}
          accent="navy"
          footer={{ href: "/publisher/transactions", linkLabel: "View transactions" }}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DashboardCard className="h-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <DashboardCardTitle>Earnings Overview</DashboardCardTitle>
                <DashboardCardDescription>Credited earnings over time</DashboardCardDescription>
              </div>
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
            </div>
            <div className="mt-4 min-h-[260px]">
              {data.earningsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.earningsChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => formatMoney(Number(v))} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="var(--theme-primary)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                  No earnings in this period yet
                </div>
              )}
            </div>
          </DashboardCard>
        </div>

        <div className="xl:col-span-4">
          <DashboardCard className="flex h-full flex-col">
            <DashboardCardTitle>Recent Leads</DashboardCardTitle>
            <DashboardCardDescription>Latest submissions from your traffic</DashboardCardDescription>
            <div className="mt-4 flex-1 space-y-3">
              {data.recentLeads.length === 0 ? (
                <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                  No leads yet. Share your Smart Link to get started.
                </div>
              ) : (
                data.recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatDate(lead.createdAt)}</p>
                      <p className={cn("mt-0.5 text-sm", lead.payoutClassName)}>
                        {lead.payoutLabel}
                      </p>
                    </div>
                    <LeadStatusBadge status={lead.status} />
                  </div>
                ))
              )}
            </div>
            <Link
              href="/publisher/leads"
              className="mt-4 text-sm font-medium text-[var(--theme-primary)] hover:underline"
            >
              View all leads →
            </Link>
          </DashboardCard>
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
