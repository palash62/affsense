"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardCard, DashboardCardTitle } from "@/components/admin/affsense-dashboard/dashboard-card";
import { formatCurrency } from "@/components/admin/admin-ui";

type Point = { month: string; paid: number };

function monthLabel(month: string, style: "short" | "long") {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString("en-US", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function PaidTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <p className="font-semibold text-foreground">{monthLabel(point.month, "long")}</p>
      <p className="mt-1 text-muted-foreground">
        Paid: <span className="font-semibold text-foreground">{formatCurrency(point.paid)}</span>
      </p>
    </div>
  );
}

export function PublisherPayoutReportChart({ monthly }: { monthly: Point[] }) {
  const hasPaid = monthly.some((p) => p.paid > 0);
  return (
    <DashboardCard>
      <DashboardCardTitle>Paid per month</DashboardCardTitle>
      <p className="mt-1 text-xs text-muted-foreground">Last 12 months, by payment date</p>
      <div className="mt-4 min-h-[240px]">
        {hasPaid ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tickFormatter={(m: string) => monthLabel(m, "short")}
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
              <Tooltip content={<PaidTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Bar dataKey="paid" fill="var(--theme-primary)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
            No payments in the last 12 months
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
