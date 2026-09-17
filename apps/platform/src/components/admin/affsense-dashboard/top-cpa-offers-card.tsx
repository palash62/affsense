"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
import type { AdminTopOfferRow } from "@/services/admin.service";

export function TopCpaOffersCard({ offers }: { offers: AdminTopOfferRow[] }) {
  const data = offers.map((o) => ({
    name: o.name.length > 14 ? `${o.name.slice(0, 14)}…` : o.name,
    payout: o.payout,
    conversions: o.conversions,
  }));

  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Top CPA Offers</DashboardCardTitle>
        <DashboardCardDescription>By affiliate payout (30d)</DashboardCardDescription>
      </div>
      {data.length === 0 ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No CPA conversions yet</p>
        </div>
      ) : (
        <div className="min-h-[220px] flex-1">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
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
                  fontSize: 13,
                }}
                formatter={(value, name) => {
                  if (name === "payout") return [`$${Number(value).toLocaleString()}`, "Payout"];
                  return [Number(value).toLocaleString(), "Conversions"];
                }}
              />
              <Bar dataKey="payout" fill="var(--theme-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
}
