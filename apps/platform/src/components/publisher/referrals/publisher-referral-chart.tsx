"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardCard, DashboardCardTitle } from "@/components/admin/affsense-dashboard/dashboard-card";
import { formatCurrency } from "@/components/admin/admin-ui";

type Point = { month: string; digital: number; cpa: number };

function EarningsTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <p className="font-semibold text-foreground">{point.month}</p>
      <p className="mt-1 text-muted-foreground">
        Digital Products: <span className="font-semibold text-foreground">{formatCurrency(point.digital)}</span>
      </p>
      <p className="text-muted-foreground">
        CPA Offers: <span className="font-semibold text-foreground">{formatCurrency(point.cpa)}</span>
      </p>
      <p className="mt-1 border-t border-border pt-1 text-muted-foreground">
        Total: <span className="font-semibold text-foreground">{formatCurrency(point.digital + point.cpa)}</span>
      </p>
    </div>
  );
}

export function PublisherReferralChart({ months }: { months: Point[] }) {
  const hasEarnings = months.some((p) => p.digital !== 0 || p.cpa !== 0);
  return (
    <DashboardCard>
      <DashboardCardTitle>Referral earnings per month</DashboardCardTitle>
      <p className="mt-1 text-xs text-muted-foreground">Last 6 months, Digital Products and CPA Offers</p>
      <div className="mt-4 min-h-[240px]">
        {hasEarnings ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={months} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tickFormatter={(m: string) => m.split(" ")[0] ?? m}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip content={<EarningsTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="digital"
                name="Digital Products"
                stackId="earnings"
                fill="var(--theme-primary)"
                maxBarSize={32}
              />
              <Bar
                dataKey="cpa"
                name="CPA Offers"
                stackId="earnings"
                fill="var(--theme-success)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
            No referral earnings in the last 6 months
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
