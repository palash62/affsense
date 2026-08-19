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
import type { AdminRevenuePoint } from "@/services/admin.service";

export function RevenueOverviewCard({ series }: { series: AdminRevenuePoint[] }) {
  if (series.length === 0) {
    return (
      <DashboardCard className="flex h-full flex-col">
        <div className="mb-4">
          <DashboardCardTitle>Revenue Overview</DashboardCardTitle>
          <DashboardCardDescription>Completed deposits over time</DashboardCardDescription>
        </div>
        <div className="flex min-h-[260px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No revenue data yet</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <DashboardCardTitle>Revenue Overview</DashboardCardTitle>
          <DashboardCardDescription>Completed deposits — last 30 days</DashboardCardDescription>
        </div>
      </div>
      <div className="min-h-[260px] flex-1">
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
              tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                fontSize: 13,
              }}
              formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--theme-chart-1)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: "var(--theme-chart-1)", stroke: "#fff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
