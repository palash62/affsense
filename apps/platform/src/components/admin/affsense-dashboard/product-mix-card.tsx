"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import type { AdminProductMixSlice } from "@/services/admin.service";

const COLORS = [
  "var(--theme-chart-1)",
  "var(--theme-chart-2)",
  "var(--theme-success)",
  "var(--warning)",
];

export function ProductMixCard({ mix }: { mix: AdminProductMixSlice[] }) {
  const total = mix.reduce((sum, d) => sum + d.value, 0);

  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Earnings Mix</DashboardCardTitle>
        <DashboardCardDescription>Affiliate payout by product (30d)</DashboardCardDescription>
      </div>
      {total === 0 ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No payout mix yet</p>
        </div>
      ) : (
        <>
          <div className="min-h-[200px] flex-1">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={mix}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {mix.map((slice, i) => (
                    <Cell key={slice.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, "Payout"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {mix.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {d.name}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    ${d.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
