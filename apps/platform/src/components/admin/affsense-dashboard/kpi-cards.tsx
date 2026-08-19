"use client";

import Link from "next/link";
import {
  ChartNoAxesCombined,
  DollarSign,
  FileText,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardCard } from "./dashboard-card";
import type { AdminDashboardStats } from "@/services/admin.service";

type KpiAccent = "blue" | "emerald" | "sky" | "amber" | "rose" | "violet";

const accentStyles: Record<KpiAccent, { chip: string; icon: string }> = {
  blue: { chip: "bg-[var(--theme-primary-soft)]", icon: "text-[var(--theme-primary)]" },
  emerald: { chip: "bg-[color-mix(in_srgb,var(--theme-success)_12%,white)]", icon: "text-[var(--theme-success)]" },
  sky: { chip: "bg-[var(--theme-primary-soft)]", icon: "text-[var(--theme-primary)]" },
  amber: { chip: "bg-[color-mix(in_srgb,var(--warning)_14%,white)]", icon: "text-[var(--warning)]" },
  rose: { chip: "bg-[color-mix(in_srgb,var(--destructive)_12%,white)]", icon: "text-destructive" },
  violet: { chip: "bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_12%,white)]", icon: "text-[var(--theme-accent-purple,#713BFF)]" },
};

function fmt(n: number, currency = false) {
  if (currency) {
    return n === 0 ? "$0.00" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return n.toLocaleString("en-US");
}

function convRate(approved: number, total: number) {
  if (total === 0) return "0%";
  return `${((approved / total) * 100).toFixed(1)}%`;
}

export function KpiCards({ stats }: { stats: AdminDashboardStats }) {
  const kpis = [
    {
      id: "total-users",
      label: "Total Users",
      value: fmt(stats.totalUsers),
      viewLabel: "View users",
      viewHref: "/admin/publishers",
      accent: "blue" as KpiAccent,
      Icon: Users,
    },
    {
      id: "active-users",
      label: "Active Users",
      value: fmt(stats.activeUsers),
      viewLabel: "View active",
      viewHref: "/admin/publishers",
      accent: "emerald" as KpiAccent,
      Icon: UserPlus,
    },
    {
      id: "total-revenue",
      label: "Total Revenue",
      value: fmt(stats.totalRevenue, true),
      viewLabel: "View deposits",
      viewHref: "/admin/deposits",
      accent: "sky" as KpiAccent,
      Icon: DollarSign,
    },
    {
      id: "total-payouts",
      label: "Total Payouts",
      value: fmt(stats.totalPayouts, true),
      viewLabel: "View payouts",
      viewHref: "/admin/payout-center",
      accent: "amber" as KpiAccent,
      Icon: Wallet,
    },
    {
      id: "total-leads",
      label: "Total Leads",
      value: fmt(stats.totalLeads),
      viewLabel: "View leads",
      viewHref: "/admin/commissions",
      accent: "rose" as KpiAccent,
      Icon: FileText,
    },
    {
      id: "conversion-rate",
      label: "Conversion Rate",
      value: convRate(stats.approvedLeads, stats.totalLeads),
      viewLabel: "View reports",
      viewHref: "/admin/reports",
      accent: "violet" as KpiAccent,
      Icon: ChartNoAxesCombined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {kpis.map((kpi) => {
        const styles = accentStyles[kpi.accent];
        return (
          <DashboardCard
            key={kpi.id}
            className="flex flex-col transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md",
                  styles.chip,
                )}
              >
                <kpi.Icon className={cn("h-5 w-5", styles.icon)} />
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {kpi.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">all time</p>
            <Link
              href={kpi.viewHref}
              className="mt-3 text-sm font-medium text-[var(--theme-primary)] hover:underline"
            >
              {kpi.viewLabel}
            </Link>
          </DashboardCard>
        );
      })}
    </div>
  );
}
