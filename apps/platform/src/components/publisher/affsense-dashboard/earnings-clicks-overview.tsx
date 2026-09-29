"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";

type SeriesPoint = { date: string; clicks: number; earnings: number };
type ChartPoint = { key: string; label: string; tooltipLabel: string; clicks: number; earnings: number };

function parseDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function toChartPoints(series: SeriesPoint[], period: string): ChartPoint[] {
  if (period !== "year") {
    return series.map((p) => {
      const day = parseDay(p.date);
      return {
        key: p.date,
        label: day.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        tooltipLabel: day.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        clicks: p.clicks,
        earnings: p.earnings,
      };
    });
  }

  const byMonth = new Map<string, ChartPoint>();
  for (const p of series) {
    const day = parseDay(p.date);
    const key = p.date.slice(0, 7);
    const point = byMonth.get(key) ?? {
      key,
      label: day.toLocaleDateString("en-GB", { month: "short" }),
      tooltipLabel: day.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      clicks: 0,
      earnings: 0,
    };
    point.clicks += p.clicks;
    point.earnings += p.earnings;
    byMonth.set(key, point);
  }
  return [...byMonth.values()];
}

function OverviewTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <p className="font-semibold text-foreground">{point.tooltipLabel}</p>
      <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-[var(--theme-primary)]" />
        Earnings: <span className="font-semibold text-foreground">{formatMoney(point.earnings)}</span>
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-[color-mix(in_srgb,var(--theme-primary)_25%,white)]" />
        Clicks: <span className="font-semibold text-foreground">{point.clicks.toLocaleString("en-US")}</span>
      </p>
    </div>
  );
}

export function EarningsClicksOverview({
  series,
  period,
}: {
  series: SeriesPoint[];
  period: string;
}) {
  const points = useMemo(() => toChartPoints(series, period), [series, period]);
  const hasActivity = points.some((p) => p.clicks > 0 || p.earnings > 0);

  return (
    <DashboardCard className="h-full">
      <DashboardCardTitle>Earnings &amp; Clicks Overview</DashboardCardTitle>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--theme-primary)]" />
          Earnings ($)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[color-mix(in_srgb,var(--theme-primary)_25%,white)]" />
          Clicks
        </span>
      </div>
      <div className="mt-4 min-h-[260px]">
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                yAxisId="earnings"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => `$${v}`}
              />
              <YAxis
                yAxisId="clicks"
                orientation="right"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip content={<OverviewTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Bar
                yAxisId="clicks"
                dataKey="clicks"
                fill="color-mix(in srgb, var(--theme-primary) 18%, white)"
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              <Line
                yAxisId="earnings"
                type="monotone"
                dataKey="earnings"
                stroke="var(--theme-primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--theme-primary)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
            No activity in this period yet
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
