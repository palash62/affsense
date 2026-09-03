"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowUpRight,
  Copy,
  Megaphone,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
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
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import { buildDigitalProductAffiliateUrl } from "@/lib/digital-product-affiliate-url";
import { buildCpaOfferTrackingUrl } from "@cpl/shared";
import { toast } from "sonner";

export type AffsensePublisherDashboardData = {
  period: string;
  kpis: {
    totalEarnings: number;
    totalEarningsTrend: string;
    pendingEarnings: number;
    availableBalance: number;
    totalReferrals: number;
    referralsTrend: string;
    tasksCompleted: number;
    tasksToday: number;
  };
  earningsChart: Array<{ date: string; label: string; amount: number }>;
  tasks: Array<{
    id: string;
    title: string;
    platform: string;
    rewardAmount: number;
    requiredAction: string;
  }>;
  topOffers: Array<{
    id: string;
    name: string;
    category: string;
    commission: string;
    earnings: number;
    sales: number;
    imageUrl: string | null;
    type: "cpa" | "product";
    hot: boolean;
    canPromote?: boolean;
    salesPageUrl?: string | null;
    affiliateTrackingParam?: string | null;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    iconKey: string | null;
    tone: "VIOLET" | "EMERALD" | "BLUE" | "AMBER";
    publishedAt: string;
  }>;
  recentReports: Array<{
    id: string;
    name: string;
    type: string;
    dateRange: string;
    generatedOn: string;
    status: string;
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

function KpiCard({
  label,
  value,
  trend,
  sub,
  href,
}: {
  label: string;
  value: string;
  trend?: string;
  sub?: string;
  href?: string;
}) {
  return (
    <DashboardCard className="p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {trend ? (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--theme-success)]">
          <ArrowUpRight className="h-3 w-3" />
          {trend}
        </p>
      ) : null}
      {sub ? <p className="mt-1 text-xs text-[var(--warning)]">{sub}</p> : null}
      {href ? (
        <Link href={href} className="mt-2 inline-block text-xs font-semibold text-[var(--theme-primary)]">
          Request Payout →
        </Link>
      ) : null}
    </DashboardCard>
  );
}

export function AffsensePublisherDashboard({ data }: { data: AffsensePublisherDashboardData }) {
  const { kpis } = data;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePeriod = data.period;
  const { data: session } = useSession();
  const publisherId = session?.user?.id ?? "";

  async function copyProductLink(offer: AffsensePublisherDashboardData["topOffers"][number]) {
    if (offer.type !== "product") return;
    const url = buildDigitalProductAffiliateUrl(
      offer.salesPageUrl,
      offer.affiliateTrackingParam,
      publisherId,
    );
    if (!url) {
      toast.error("Sales page URL is not configured for this product");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tracked link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function copyCpaLink(offer: AffsensePublisherDashboardData["topOffers"][number]) {
    if (offer.type !== "cpa") return;
    if (!offer.canPromote) {
      toast.error("Request access on the CPA Offers page before copying a tracking link");
      return;
    }
    if (!publisherId) {
      toast.error("Sign in to copy your tracking link");
      return;
    }
    const url = buildCpaOfferTrackingUrl(offer.id, { publisherId });
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tracked link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total Earnings"
          value={formatMoney(kpis.totalEarnings)}
          trend={`${kpis.totalEarningsTrend} vs last period`}
        />
        <KpiCard
          label="Pending Earnings"
          value={formatMoney(kpis.pendingEarnings)}
          sub="Pending approval"
        />
        <KpiCard
          label="Available Balance"
          value={formatMoney(kpis.availableBalance)}
          href="/publisher/payouts/request"
        />
        <KpiCard
          label="Total Referrals"
          value={String(kpis.totalReferrals)}
          trend={`${kpis.referralsTrend} new this week`}
        />
        <KpiCard
          label="Tasks Completed"
          value={String(kpis.tasksCompleted)}
          trend={`+${kpis.tasksToday} today`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DashboardCard className="h-full p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DashboardCardTitle>Earnings Overview</DashboardCardTitle>
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
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.earningsChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
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
            </div>
          </DashboardCard>
        </div>
        <div className="xl:col-span-4">
          <DashboardCard className="flex h-full flex-col p-5">
            <DashboardCardTitle>Get Paid Tasks</DashboardCardTitle>
            <div className="mt-4 space-y-3">
              {data.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.platform}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-[var(--theme-success)]">
                      {formatMoney(task.rewardAmount)}
                    </span>
                    <Button size="sm" className="h-8 rounded-md bg-[var(--theme-primary)]">
                      Start
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/publisher/get-paid-tasks"
              className="mt-4 text-xs font-semibold text-[var(--theme-primary)]"
            >
              Check all tasks →
            </Link>
          </DashboardCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DashboardCard className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4">
              <DashboardCardTitle>Top Performing Offers</DashboardCardTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Offer</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Commission</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topOffers.map((offer) => (
                    <tr key={offer.id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">
                        {offer.name}
                        {offer.hot ? (
                          <span className="ml-2 rounded bg-[var(--theme-primary-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--theme-primary)]">
                            Hot
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{offer.category}</td>
                      <td className="px-5 py-3 font-semibold text-[var(--theme-success)]">
                        {offer.commission}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {offer.type === "product" ? (
                            <>
                              <ButtonLink
                                href={`/publisher/marketplace/${offer.id}`}
                                size="sm"
                                className="h-8 rounded-md bg-[var(--theme-primary)]"
                              >
                                Promote Now
                              </ButtonLink>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 rounded-md p-0"
                                onClick={() => void copyProductLink(offer)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <ButtonLink
                                href="/publisher/cpa-offers"
                                size="sm"
                                className="h-8 rounded-md bg-[var(--theme-primary)]"
                              >
                                {offer.canPromote ? "Promote Now" : "Request Access"}
                              </ButtonLink>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 rounded-md p-0"
                                disabled={!offer.canPromote}
                                onClick={() => void copyCpaLink(offer)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </div>
        <div className="xl:col-span-4">
          <DashboardCard className="h-full p-5">
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
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DashboardCard className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4">
              <DashboardCardTitle>Recent Reports</DashboardCardTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Report</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentReports.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{r.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.type}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] px-2 py-0.5 text-xs font-semibold text-[var(--theme-success)]">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </div>
        <div className="xl:col-span-4">
          <DashboardCard className="p-5">
            <DashboardCardTitle>Quick Links</DashboardCardTitle>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Request Payout", href: "/publisher/payouts/request", icon: Wallet },
                { label: "Payment History", href: "/publisher/transactions", icon: TrendingUp },
                { label: "Marketing Materials", href: "/publisher/marketplace", icon: Megaphone },
                { label: "Leaderboard", href: "/publisher/reports/performance", icon: Users },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <ButtonLink
                    key={item.label}
                    href={item.href}
                    className="flex h-auto flex-col items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-left hover:bg-muted/50"
                  >
                    <Icon className="h-4 w-4 text-[var(--theme-primary)]" />
                    <span className="text-xs font-semibold text-foreground">{item.label}</span>
                  </ButtonLink>
                );
              })}
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
