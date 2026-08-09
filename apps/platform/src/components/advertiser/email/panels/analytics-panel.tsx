"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Mail,
  MousePointerClick,
} from "lucide-react";
import { LeadsTrendChart, PerformanceBarChart } from "@/components/dashboard/dashboard-charts";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailModuleShell } from "../email-module-shell";

type StatsSource = "all" | "broadcast" | "automation";

type Stats = {
  delivered: number;
  sent?: number;
  opens: number;
  clicks: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  trend: { date: string; sends: number; opens: number; clicks: number }[];
};

type NamedOption = { id: string; name: string };

export function AnalyticsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<StatsSource>("all");
  const [selectedId, setSelectedId] = useState("");
  const [broadcasts, setBroadcasts] = useState<NamedOption[]>([]);
  const [automations, setAutomations] = useState<NamedOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [bRes, aRes] = await Promise.all([
          fetch("/api/v1/advertiser/email/broadcasts", { credentials: "same-origin" }),
          fetch("/api/v1/advertiser/email/automations", { credentials: "same-origin" }),
        ]);
        const [bJson, aJson] = await Promise.all([
          bRes.json().catch(() => null),
          aRes.json().catch(() => null),
        ]);
        if (cancelled) return;
        setBroadcasts(
          ((bJson?.data ?? []) as { id: string; name: string }[]).map((b) => ({
            id: b.id,
            name: b.name,
          })),
        );
        setAutomations(
          ((aJson?.data ?? []) as { id: string; name: string }[]).map((a) => ({
            id: a.id,
            name: a.name,
          })),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ days: "30" });
    params.set("source", source);
    if (source === "broadcast" && selectedId) {
      params.set("broadcastId", selectedId);
    }
    if (source === "automation" && selectedId) {
      params.set("automationId", selectedId);
    }

    void fetch(`/api/v1/advertiser/email/stats?${params}`, {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setStats(j.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [source, selectedId]);

  const itemOptions = useMemo(
    () => (source === "broadcast" ? broadcasts : source === "automation" ? automations : []),
    [source, broadcasts, automations],
  );

  const bounceLabel = source === "all" ? "Bounced contacts" : "Bounced";

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
        {
          label: "Delivered",
          value: stats && !loading ? stats.delivered.toLocaleString() : "—",
          icon: CheckCircle,
          accent: "green",
        },
        {
          label: "Open rate",
          value: stats && !loading ? `${stats.openRate}%` : "—",
          icon: Mail,
          variant: "leads",
        },
        {
          label: "Click rate",
          value: stats && !loading ? `${stats.clickRate}%` : "—",
          icon: MousePointerClick,
          accent: "purple",
        },
        {
          label: bounceLabel,
          value: stats && !loading ? stats.bounced.toLocaleString() : "—",
          icon: AlertTriangle,
          accent: "red",
        },
      ]}
      showToolbar={false}
    >
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500">Source</Label>
          <Select
            value={source}
            onValueChange={(v) => {
              setSource((v as StatsSource) || "all");
              setSelectedId("");
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="broadcast">Broadcasts</SelectItem>
              <SelectItem value="automation">Automations</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {source !== "all" ? (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">
              {source === "broadcast" ? "Broadcast" : "Automation"}
            </Label>
            <Select
              value={selectedId || "__all__"}
              onValueChange={(v) => {
                setSelectedId(!v || v === "__all__" ? "" : v);
              }}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue
                  placeholder={
                    source === "broadcast" ? "All broadcasts" : "All automations"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  {source === "broadcast" ? "All broadcasts" : "All automations"}
                </SelectItem>
                {itemOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LeadsTrendChart title="Opens over time" data={opensTrend} />
        <PerformanceBarChart title="Clicks by day" data={clicksBars} />
      </div>
      <div className="premium-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[var(--theme-primary)]" />
          <h3 className="text-base font-semibold text-slate-900">Delivery overview</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Delivered (count)",
              value: stats?.delivered ?? 0,
              pct: `Est. delivery ${deliveryRate}%`,
            },
            {
              label: "Opens (events)",
              value: stats?.opens ?? 0,
              pct: `Open rate ${stats?.openRate ?? 0}%`,
            },
            {
              label: "Clicks (events)",
              value: stats?.clicks ?? 0,
              pct: `Click rate ${stats?.clickRate ?? 0}%`,
            },
            {
              label: bounceLabel,
              value: stats?.bounced ?? 0,
              pct:
                stats && stats.delivered > 0
                  ? `${Math.round((stats.bounced / (stats.delivered + stats.bounced)) * 100)}% of delivered+bounced`
                  : "0%",
            },
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
