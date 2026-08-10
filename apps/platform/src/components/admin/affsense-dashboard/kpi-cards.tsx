"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  DollarSign,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardCard } from "./dashboard-card";
import { affsenseKpis, type KpiAccent } from "./mock-data";

const accentStyles: Record<KpiAccent, { chip: string; icon: string }> = {
  blue: { chip: "bg-[var(--theme-primary-soft)]", icon: "text-[var(--theme-primary)]" },
  emerald: { chip: "bg-[color-mix(in_srgb,var(--theme-success)_12%,white)]", icon: "text-[var(--theme-success)]" },
  sky: { chip: "bg-[var(--theme-primary-soft)]", icon: "text-[var(--theme-primary)]" },
  amber: { chip: "bg-[color-mix(in_srgb,var(--warning)_14%,white)]", icon: "text-[var(--warning)]" },
  rose: { chip: "bg-[color-mix(in_srgb,var(--destructive)_12%,white)]", icon: "text-destructive" },
  violet: { chip: "bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_12%,white)]", icon: "text-[var(--theme-accent-purple,#713BFF)]" },
};

const icons = {
  "total-users": Users,
  "active-users": UserPlus,
  "total-revenue": DollarSign,
  "total-payouts": Wallet,
  "total-sales": ShoppingCart,
  "conversion-rate": ChartNoAxesCombined,
} as const;

export function KpiCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {affsenseKpis.map((kpi) => {
        const Icon = icons[kpi.id as keyof typeof icons] ?? Users;
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
                <Icon className={cn("h-5 w-5", styles.icon)} />
              </div>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[color-mix(in_srgb,var(--theme-success)_12%,white)] px-2 py-0.5 text-xs font-semibold text-[var(--theme-success)]">
                <ArrowUpRight className="h-3 w-3" />
                {kpi.delta}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {kpi.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">vs last 7 days</p>
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
