"use client";

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
} from "./dashboard-card";
import type { AdminSeriesPoint } from "@/services/admin.service";

export function EarningsOverviewCard({ series }: { series: AdminSeriesPoint[] }) {
  const hasData = series.some((p) => p.amount > 0);

  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Earnings Overview</DashboardCardTitle>
        <DashboardCardDescription>
          Affiliate payouts — CPA, Offer Wall, digital and tasks (30 days)
        </DashboardCardDescription>
      </div>
      <div className="min-h-[260px] flex-1">
        {!hasData ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No earnings data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Number(v)}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  fontSize: 13,
                }}
                formatter={(value) => [`$${Number(value).toLocaleString()}`, "Payout"]}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="var(--theme-chart-1)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "var(--theme-chart-1)", stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </DashboardCard>
  );
}
