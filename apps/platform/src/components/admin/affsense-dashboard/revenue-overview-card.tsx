"use client";

import { ChevronDown } from "lucide-react";
import {
  CartesianGrid,
  Legend,
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
import { affsenseRevenueSeries } from "./mock-data";

export function RevenueOverviewCard() {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <DashboardCardTitle>Revenue Overview</DashboardCardTitle>
          <DashboardCardDescription>Revenue vs net profit</DashboardCardDescription>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-sm"
        >
          Last 7 Days
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="min-h-[260px] flex-1">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={affsenseRevenueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              formatter={(value, name) => [
                `$${Number(value).toLocaleString()}`,
                name === "revenue" ? "Revenue ($)" : "Net Profit ($)",
              ]}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingBottom: 8, color: "var(--muted-foreground)" }}
              formatter={(value) =>
                value === "revenue" ? "Revenue ($)" : "Net Profit ($)"
              }
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--theme-chart-1)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: "var(--theme-chart-1)", stroke: "#fff", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="var(--theme-success)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: "var(--theme-success)", stroke: "#fff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
