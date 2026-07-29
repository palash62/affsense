"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Mail,
  MousePointerClick,
} from "lucide-react";
import { LeadsTrendChart, PerformanceBarChart } from "@/components/dashboard/dashboard-charts";
import { EmailModuleShell } from "../email-module-shell";

type Stats = {
  delivered: number;
  opens: number;
  clicks: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  trend: { date: string; sends: number; opens: number; clicks: number }[];
};

export function AnalyticsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/stats")
      .then((r) => r.json())
      .then((j) => setStats(j.data))
      .catch(() => {});
  }, []);

  const deliveryRate =
    stats && stats.delivered > 0
      ? Math.round(
          (stats.delivered / (stats.delivered + (stats.bounced ?? 0))) * 100,
        )
      : 0;

  const opensTrend = stats?.trend?.map((t) => ({ date: t.date, count: t.opens })) ?? [];
  const clicksBars = stats?.trend?.map((t) => ({ name: t.date.slice(5), value: t.clicks })) ?? [];

  return (
    <EmailModuleShell
      title="Analytics"
      description="Track email delivery, opens, clicks, and bounces across your campaigns."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Analytics" },
      ]}
      stats={[
        { label: "Delivered", value: stats ? `${deliveryRate}%` : "—", icon: CheckCircle, accent: "green" },
        { label: "Opens", value: stats ? `${stats.openRate}%` : "—", icon: Mail, variant: "leads" },
        { label: "Clicks", value: stats ? `${stats.clickRate}%` : "—", icon: MousePointerClick, accent: "purple" },
        { label: "Bounces", value: stats ? stats.bounced.toLocaleString() : "—", icon: AlertTriangle, accent: "red" },
      ]}
      showToolbar={false}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <LeadsTrendChart title="Open Rate Trend" data={opensTrend} />
        <PerformanceBarChart title="Clicks by Day" data={clicksBars} />
      </div>
      <div className="premium-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[var(--theme-primary)]" />
          <h3 className="text-base font-semibold text-slate-900">Delivery Overview</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Delivered", value: stats?.delivered ?? 0, pct: `${deliveryRate}%` },
            { label: "Opened", value: stats?.opens ?? 0, pct: `${stats?.openRate ?? 0}%` },
            { label: "Clicked", value: stats?.clicks ?? 0, pct: `${stats?.clickRate ?? 0}%` },
            { label: "Bounced", value: stats?.bounced ?? 0, pct: stats && stats.delivered > 0 ? `${Math.round((stats.bounced / (stats.delivered + stats.bounced)) * 100)}%` : "0%" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50"
            >
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{item.value.toLocaleString()}</p>
              <p className="text-xs text-[var(--theme-primary)]">{item.pct}</p>
            </div>
          ))}
        </div>
      </div>
    </EmailModuleShell>
  );
}
