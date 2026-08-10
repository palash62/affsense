"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const cardClass =
  "premium-card p-6";

const PIE_COLORS = [
  "var(--theme-success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--theme-chart-1)",
  "var(--theme-chart-4)",
];

interface TrendChartProps {
  title: string;
  data: Array<{ date: string; count: number }>;
  embedded?: boolean;
}

export function LeadsTrendChart({ title, data, embedded }: TrendChartProps) {
  const chart = (
    <>
      {!embedded && (
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)" }} />
          <Line type="monotone" dataKey="count" stroke="var(--theme-chart-1)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );

  if (embedded) return chart;

  return <div className={cardClass}>{chart}</div>;
}

interface BarChartProps {
  title: string;
  data: Array<{ name: string; value: number }>;
}

export function PerformanceBarChart({ title, data }: BarChartProps) {
  return (
    <div className={cardClass}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)" }} />
          <Bar dataKey="value" fill="var(--theme-chart-1)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DonutChartProps {
  title: string;
  data: Array<{ name: string; value: number }>;
}

export function DonutChart({ title, data }: DonutChartProps) {
  return (
    <div className={cardClass}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
