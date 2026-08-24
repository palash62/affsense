"use client";

import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PublisherCommissionChartPoint,
  PublisherCommissionSlice,
} from "@/services/digital-product.service";

const PIE_COLORS = [
  "var(--theme-chart-1)",
  "var(--theme-chart-4)",
  "var(--theme-success)",
  "var(--warning)",
  "var(--theme-primary)",
];

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DonutCard({
  title,
  totalLabel,
  data,
}: {
  title: string;
  totalLabel: string;
  data: PublisherCommissionSlice[];
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No data in this range.</p>
      ) : (
        <>
          <div className="relative mx-auto h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatUsd(Number(value ?? 0))}
                  contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm font-bold text-foreground">{totalLabel}</p>
            </div>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs">
            {data.map((row, i) => (
              <li key={row.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="truncate text-muted-foreground">{row.name}</span>
                </span>
                <span className="font-medium text-foreground">
                  {total > 0 ? `${((row.value / total) * 100).toFixed(0)}%` : "0%"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function PublisherCommissionCharts({
  series,
  typeSlices,
  productSlices,
  commissionTotal,
}: {
  series: PublisherCommissionChartPoint[];
  typeSlices: PublisherCommissionSlice[];
  productSlices: PublisherCommissionSlice[];
  commissionTotal: number;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
      <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-semibold text-foreground">Earnings overview</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Sales and commission by day</p>
        <div className="mt-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatUsd(Number(value ?? 0)),
                  name === "sales" ? "Sales" : "Commission",
                ]}
                contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)" }}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="var(--theme-chart-1)"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="commission"
                stroke="var(--theme-chart-4)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DonutCard
        title="Commission by type"
        totalLabel={formatUsd(commissionTotal)}
        data={typeSlices}
      />
      <DonutCard
        title="Top products"
        totalLabel={formatUsd(productSlices.reduce((s, r) => s + r.value, 0))}
        data={productSlices}
      />
    </div>
  );
}
