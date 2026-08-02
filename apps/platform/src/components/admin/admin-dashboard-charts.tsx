"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const cardClass =
  "rounded-[18px] border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md";

interface LeadsTrendChartProps {
  data: Array<{ date: string; count: number }>;
}

export function AdminLeadsTrendChart({ data }: LeadsTrendChartProps) {
  return (
    <div className={cardClass}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">Leads Trend</h3>
        <p className="mt-0.5 text-sm text-slate-500">Last 30 days performance</p>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--theme-chart-1)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--theme-chart-2)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="leadsStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--theme-chart-1)" />
                <stop offset="100%" stopColor="var(--theme-chart-2)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              tickFormatter={(v) => v.slice(5)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="url(#leadsStroke)"
              strokeWidth={2.5}
              fill="url(#leadsGradient)"
              dot={false}
              activeDot={{ r: 5, fill: "var(--theme-chart-1)", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface RevenueTrendChartProps {
  data: Array<{ date: string; amount: number }>;
}

export function AdminRevenueTrendChart({ data }: RevenueTrendChartProps) {
  return (
    <div className={cardClass}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">Revenue Trend</h3>
        <p className="mt-0.5 text-sm text-slate-500">Platform commission — last 30 days</p>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              tickFormatter={(v) => v.slice(5)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Revenue"]}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#8B5CF6"
              strokeWidth={2.5}
              fill="url(#revenueGradient)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface LeadStatusChartProps {
  data: Array<{ name: string; value: number; color: string }>;
}

export function AdminLeadStatusChart({ data }: LeadStatusChartProps) {
  return (
    <div className={cardClass}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">Lead Status</h3>
        <p className="mt-0.5 text-sm text-slate-500">Distribution breakdown</p>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-5">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-600">{item.name}</span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlatformBarChartProps {
  data: Array<{ name: string; value: number }>;
}

export function AdminPlatformBarChart({ data }: PlatformBarChartProps) {
  const barColors = [
    "var(--theme-chart-1)",
    "var(--theme-chart-2)",
    "#F97316",
    "var(--theme-success)",
  ];

  return (
    <div className={cardClass}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">Platform Overview</h3>
        <p className="mt-0.5 text-sm text-slate-500">Key entity counts</p>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={barColors[i % barColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ProgressStatProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

export function ColorfulProgressStat({ label, value, max, color }: ProgressStatProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function AdminHealthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(cardClass, className)}>{children}</div>;
}
