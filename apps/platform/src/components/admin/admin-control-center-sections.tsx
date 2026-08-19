"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  Megaphone,
  Users,
  XCircle,
  TrendingUp,
  Minus,
} from "lucide-react";
import type { AdminControlCenterData } from "@/services/admin-dashboard.service";
import { formatCurrency } from "@/components/admin/admin-ui";
import { ButtonLink } from "@/components/ui/button-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const cardClass =
  "overflow-hidden rounded-[18px] border border-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-md";

const accentColors = {
  violet: "border-t-violet-500",
  emerald: "border-t-emerald-500",
  sky: "border-t-sky-500",
  amber: "border-t-amber-500",
  rose: "border-t-rose-500",
  indigo: "border-t-indigo-500",
} as const;

type AccentColor = keyof typeof accentColors;

function AccentCard({
  accent = "violet",
  className,
  children,
  padding = true,
}: {
  accent?: AccentColor;
  className?: string;
  children: ReactNode;
  padding?: boolean;
}) {
  return (
    <div className={cn(cardClass, "border-t-[3px]", accentColors[accent], className)}>
      <div className={cn(padding && "p-6")}>{children}</div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function AdminWelcomeSummary({
  userName,
  platformStatus,
  summary,
}: {
  userName: string;
  platformStatus: AdminControlCenterData["platformStatus"];
  summary: AdminControlCenterData["summary"];
}) {
  // Compute greeting/date on the client only — server and browser timezones often differ.
  const [greeting, setGreeting] = useState("Welcome");
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening");
    setTodayLabel(format(new Date(), "EEEE, MMMM d, yyyy"));
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-[18px] px-6 py-5 shadow-md"
      style={{
        backgroundImage: "linear-gradient(to right, var(--theme-hero-from), var(--theme-hero-to))",
      }}
    >
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">
            Platform Control Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {greeting}, {userName} 👋
          </h1>
          <p className="mt-2 text-sm text-white/85">
            {todayLabel ? `${todayLabel} · ` : null}Platform is{" "}
            <span
              className={cn(
                "font-semibold",
                platformStatus === "Operational" ? "text-emerald-200" : "text-amber-200",
              )}
            >
              {platformStatus === "Operational" ? "running normally" : "experiencing issues"}
            </span>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              {
                label: "Today's leads",
                value: summary.todaysLeads,
                className: "bg-white/15 text-white border-white/20",
              },
              {
                label: "Pending approval",
                value: summary.pendingLeads,
                className: "bg-amber-400/20 text-amber-50 border-amber-200/30",
              },
              {
                label: "Withdrawals",
                value: summary.pendingWithdrawals,
                className: "bg-emerald-400/20 text-emerald-50 border-emerald-200/30",
              },
              {
                label: "Open tickets",
                value: summary.openTickets,
                className: "bg-sky-400/20 text-sky-50 border-sky-200/30",
              },
            ].map((chip) => (
              <div
                key={chip.label}
                className={cn(
                  "rounded-xl border px-3 py-2 backdrop-blur-sm",
                  chip.className,
                )}
              >
                <p className="text-lg font-bold leading-none">{chip.value}</p>
                <p className="mt-1 text-[11px] font-medium opacity-90">{chip.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ButtonLink
            href="/admin/leads"
            className="rounded-xl bg-card px-4 text-[var(--theme-hero-btn-text)] shadow-sm hover:bg-card/90"
          >
            Review Leads
          </ButtonLink>
          <ButtonLink
            href="/admin/payout-center"
            variant="outline"
            className="rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            Process Withdrawals
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

export function AdminActionCenter({
  items,
}: {
  items: AdminControlCenterData["actionItems"];
}) {
  const approvalIds = new Set([
    "leads",
    "campaigns",
    "advertisers",
    "publishers",
  ]);
  const approvalItems = items.filter((item) => approvalIds.has(item.id));
  const opsItems = items.filter((item) => !approvalIds.has(item.id));

  const approvalTotal = approvalItems.reduce((sum, item) => sum + item.count, 0);
  const opsTotal = opsItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <AccentCard accent="rose">
      <SectionHeader
        title="Action Center"
        description="Pending work grouped by priority area"
      />
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
          All clear — no pending actions require your attention.
        </p>
      ) : (
        <Tabs defaultValue="approvals">
          <TabsList className="mb-4 h-10 w-full max-w-md bg-muted p-1">
            <TabsTrigger value="approvals" className="flex-1 gap-2 px-4">
              Approvals
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                {approvalTotal}
              </span>
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex-1 gap-2 px-4">
              Payments & Support
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                {opsTotal}
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="approvals">
            <AdminActionList list={approvalItems} />
          </TabsContent>
          <TabsContent value="operations">
            <AdminActionList list={opsItems} />
          </TabsContent>
        </Tabs>
      )}
    </AccentCard>
  );
}

function AdminActionList({ list }: { list: AdminControlCenterData["actionItems"] }) {
  if (list.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/80 px-4 py-8 text-center text-sm text-emerald-800">
        All clear in this queue.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={cn(
            "group flex items-center justify-between rounded-xl border p-4 transition-all hover:shadow-sm",
            item.critical
              ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/40 hover:border-amber-300"
              : "border-border bg-muted/60 hover:border-[var(--theme-primary)]/25 hover:bg-[var(--theme-primary-soft)]/40",
          )}
        >
          <div>
            <p className="text-2xl font-bold text-foreground">{item.count}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{item.label}</p>
            <p className="mt-2 text-xs font-semibold text-[var(--theme-primary)] group-hover:underline">
              {item.action}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--theme-primary)]" />
        </Link>
      ))}
    </div>
  );
}

export function AdminPendingApprovalCenter({
  lanes,
}: {
  lanes: AdminControlCenterData["approvalLanes"];
}) {
  return (
    <AccentCard accent="amber">
      <SectionHeader
        title="Pending Approval Center"
        description="All approval workflows in one place"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {lanes.map((lane, index) => {
          const accents: AccentColor[] = ["violet", "emerald", "sky", "indigo", "amber"];
          const accent = accents[index % accents.length];
          return (
          <Link
            key={lane.id}
            href={lane.href}
            className={cn(
              "rounded-xl border border-border border-t-[3px] bg-gradient-to-b from-white to-slate-50/80 p-4 transition-all hover:shadow-sm",
              accentColors[accent],
              lane.count > 0
                ? "hover:border-[var(--theme-primary)]/30"
                : "opacity-90",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {lane.title}
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">{lane.count}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  lane.status === "Clear"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-orange-50 text-orange-700",
                )}
              >
                {lane.status}
              </span>
              <span className="text-xs font-medium text-[var(--theme-primary)]">View</span>
            </div>
          </Link>
          );
        })}
      </div>
    </AccentCard>
  );
}

export function AdminTopPerformers({
  data,
}: {
  data: AdminControlCenterData["topPerformers"];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {[
        {
          title: "Top Advertisers",
          icon: Building2,
          rows: data.advertisers.map((a) => ({
            name: a.name,
            primary: `$${a.spend.toFixed(2)} spend`,
            secondary: `${a.leads} leads · ${a.campaigns} campaigns`,
          })),
        },
        {
          title: "Top Publishers",
          icon: Users,
          rows: data.publishers.map((p) => ({
            name: p.name,
            primary: `${p.approvedLeads} approved leads`,
            secondary: `$${p.earnings.toFixed(2)} balance`,
          })),
        },
        {
          title: "Top Campaigns",
          icon: Megaphone,
          rows: data.campaigns.map((c) => ({
            name: c.name,
            primary: `${c.leads} leads`,
            secondary: `$${c.revenue.toFixed(2)} revenue`,
          })),
        },
      ].map((block, blockIndex) => {
        const accents: AccentColor[] = ["violet", "emerald", "sky"];
        const iconBg = ["bg-violet-50 text-violet-600", "bg-emerald-50 text-emerald-600", "bg-sky-50 text-sky-600"];
        const Icon = block.icon;
        return (
          <AccentCard key={block.title} accent={accents[blockIndex % 3]}>
            <div className="mb-4 flex items-center gap-2">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconBg[blockIndex % 3])}>
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{block.title}</h3>
            </div>
            <div className="space-y-3">
              {block.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet</p>
              ) : (
                block.rows.map((row, i) => (
                  <div
                    key={`${row.name}-${i}`}
                    className="rounded-lg border border-border bg-muted/50 px-3 py-2.5"
                  >
                    <p className="text-sm font-medium text-foreground">{row.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.primary}</p>
                    <p className="text-xs text-muted-foreground">{row.secondary}</p>
                  </div>
                ))
              )}
            </div>
          </AccentCard>
        );
      })}
    </div>
  );
}

export function AdminPlatformHealthPanel({
  health,
  pendingPayouts,
  openTickets,
}: {
  health: AdminControlCenterData["platformHealth"];
  pendingPayouts: number;
  openTickets: number;
}) {
  const services = Object.entries(health).map(([key, status]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    status,
  }));

  return (
    <AccentCard accent="emerald">
      <SectionHeader title="Platform Health" description="Technical systems status" />
      <div className="space-y-2">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
          >
            <span className="text-sm text-foreground">{service.name}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                service.status === "Healthy"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700",
              )}
            >
              {service.status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-muted/80 p-3 text-center">
          <p className="text-xl font-bold text-foreground">{pendingPayouts}</p>
          <p className="text-xs text-muted-foreground">Pending payouts</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/80 p-3 text-center">
          <p className="text-xl font-bold text-foreground">{openTickets}</p>
          <p className="text-xs text-muted-foreground">Open tickets</p>
        </div>
      </div>
    </AccentCard>
  );
}

export function AdminProfitOverview({
  adminProfit,
}: {
  adminProfit: AdminControlCenterData["adminProfit"];
}) {
  const rows = [
    { label: "Today", snapshot: adminProfit.today, highlight: false },
    { label: "Last 7 Days", snapshot: adminProfit.last7Days, highlight: false },
    { label: "Last 30 Days", snapshot: adminProfit.last30Days, highlight: false },
    { label: "Lifetime", snapshot: adminProfit.lifetime, highlight: true },
  ];

  const lifetime = adminProfit.lifetime;

  return (
    <AccentCard accent="emerald">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <TrendingUp className="h-4 w-4" />
        </div>
        <SectionHeader
          title="Admin Profit"
          description="Advertiser payments − publisher payouts − referral pay"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "rounded-xl border p-3",
              row.highlight
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50"
                : "border-border bg-muted/50",
            )}
          >
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p
              className={cn(
                "mt-1 text-lg font-bold",
                row.snapshot.adminProfit >= 0
                  ? row.highlight
                    ? "text-emerald-700"
                    : "text-foreground"
                  : "text-red-600",
              )}
            >
              {formatCurrency(row.snapshot.adminProfit)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-sky-50/60 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Advertiser payments</p>
          <p className="mt-1 text-lg font-bold text-sky-700">
            {formatCurrency(lifetime.advertiserPayment)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50/60 px-4 py-3">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Minus className="h-3 w-3" />
            Publisher payouts
          </p>
          <p className="mt-1 text-lg font-bold text-amber-700">
            {formatCurrency(lifetime.publisherPayout)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50/60 px-4 py-3">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Minus className="h-3 w-3" />
            Referral pay
          </p>
          <p className="mt-1 text-lg font-bold text-violet-700">
            {formatCurrency(lifetime.referralPay)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Publisher lead earnings and referral commissions reduce admin profit after advertisers pay for
        leads.
      </p>
    </AccentCard>
  );
}

export function AdminRevenueOverview({
  revenue,
}: {
  revenue: AdminControlCenterData["revenue"];
}) {
  const rows = [
    { label: "Today", value: revenue.today, highlight: false },
    { label: "Last 7 Days", value: revenue.last7Days, highlight: false },
    { label: "Last 30 Days", value: revenue.last30Days, highlight: false },
    { label: "Last Month", value: revenue.lastMonth, highlight: false },
    { label: "Lifetime", value: revenue.lifetime, highlight: true },
  ];

  return (
    <AccentCard accent="violet">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <DollarSign className="h-4 w-4" />
        </div>
        <SectionHeader title="Revenue Overview" description="Platform commission growth" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "rounded-xl border p-3",
              row.highlight
                ? "border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50"
                : "border-border bg-muted/50",
            )}
          >
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className={cn("mt-1 text-lg font-bold", row.highlight ? "text-violet-700" : "text-foreground")}>
              ${row.value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </AccentCard>
  );
}

export function AdminBusinessOverviewStats({
  data,
}: {
  data: AdminControlCenterData["businessOverview"];
}) {
  const stats = [
    { label: "Revenue Today", value: `$${data.revenueToday.toFixed(2)}`, icon: DollarSign },
    { label: "Revenue (MTD)", value: `$${data.revenueMonth.toFixed(2)}`, icon: DollarSign },
    { label: "Active Campaigns", value: data.activeCampaigns, icon: Megaphone },
    { label: "Advertisers", value: data.totalAdvertisers, icon: Building2 },
    { label: "Publishers", value: data.totalPublishers, icon: Users },
    { label: "Today's Leads", value: data.todaysLeads, icon: FileText },
    { label: "Approved Today", value: data.todaysApprovedLeads, icon: CheckCircle2 },
    { label: "Rejected Today", value: data.todaysRejectedLeads, icon: XCircle },
    {
      label: "Conversion Rate",
      value: `${data.conversionRate.toFixed(1)}%`,
      icon: AlertTriangle,
    },
    { label: "Approval Rate", value: `${data.approvalRate.toFixed(1)}%`, icon: CheckCircle2 },
  ];

  const statStyles = [
    { bg: "bg-violet-50", icon: "text-violet-600" },
    { bg: "bg-indigo-50", icon: "text-indigo-600" },
    { bg: "bg-orange-50", icon: "text-orange-600" },
    { bg: "bg-purple-50", icon: "text-purple-600" },
    { bg: "bg-emerald-50", icon: "text-emerald-600" },
    { bg: "bg-sky-50", icon: "text-sky-600" },
    { bg: "bg-green-50", icon: "text-green-600" },
    { bg: "bg-red-50", icon: "text-red-600" },
    { bg: "bg-amber-50", icon: "text-amber-600" },
    { bg: "bg-teal-50", icon: "text-teal-600" },
  ];

  return (
    <AccentCard accent="indigo">
      <SectionHeader title="Business Overview" description="Today's platform performance" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const style = statStyles[index % statStyles.length];
          return (
            <div
              key={stat.label}
              className={cn("rounded-xl border border-border p-3", style.bg)}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className={cn("h-3.5 w-3.5", style.icon)} />
                <span className="text-xs font-medium">{stat.label}</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">{stat.value}</p>
            </div>
          );
        })}
      </div>
    </AccentCard>
  );
}
