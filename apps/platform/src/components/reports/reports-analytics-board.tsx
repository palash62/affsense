"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActivityTrendPoint,
  CampaignPerformanceRow,
  GeoBreakdownRow,
  LeadsStatusMixItem,
} from "@/services/report.service";

const cardClass = "premium-card p-5 sm:p-6";

const STATUS_COLORS: Record<string, string> = {
  Approved: "#22C55E",
  Pending: "#F97316",
  Rejected: "#EF4444",
  CAPTURED: "#94A3B8",
  VALIDATING: "#A78BFA",
  "No data": "#CBD5E1",
};

const BAR_PALETTE = ["#0EA5E9", "#22C55E", "#F97316", "#8B5CF6", "#EF4444", "#14B8A6"];

function ChartCard({
  title,
  description,
  children,
  legend,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  legend?: React.ReactNode;
}) {
  return (
    <div className={cardClass}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
        {legend}
      </div>
      {children}
    </div>
  );
}

function tooltipStyle() {
  return {
    borderRadius: "12px",
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  };
}

/** Full-width daily activity: clicks, leads, approved */
export function ReportsActivityTrendChart({
  data,
  description = "Daily clicks, leads, and approved volume across the selected range",
}: {
  data: ActivityTrendPoint[];
  description?: string;
}) {
  const series =
    data.length > 0
      ? data
      : [{ date: new Date().toISOString().slice(0, 10), clicks: 0, leads: 0, approved: 0 }];

  return (
    <ChartCard title="Traffic & lead activity" description={description}>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="reportsClicksFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="reportsLeadsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickFormatter={(v) => String(v).slice(5)}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle()} />
          <Legend />
          <Area
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke="#0EA5E9"
            strokeWidth={2}
            fill="url(#reportsClicksFill)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="leads"
            name="Leads"
            stroke="#8B5CF6"
            strokeWidth={2.5}
            fill="url(#reportsLeadsFill)"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="approved"
            name="Approved"
            stroke="#22C55E"
            strokeWidth={2.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Full-width grouped bars: campaigns by clicks / leads / approved / spend */
export function ReportsCampaignCompareChart({
  rows,
  moneyLabel = "Spend",
}: {
  rows: CampaignPerformanceRow[];
  moneyLabel?: string;
}) {
  const data = rows.slice(0, 10).map((row) => ({
    name:
      row.campaignName.length > 22 ? `${row.campaignName.slice(0, 22)}…` : row.campaignName,
    clicks: row.clicks,
    leads: row.leads,
    approved: row.approvedLeads,
    spend: row.spend,
  }));

  return (
    <ChartCard
      title="Campaign comparison"
      description="Top campaigns by lead volume — clicks, leads, approvals, and spend side by side"
    >
      <ResponsiveContainer width="100%" height={Math.max(320, data.length * 28 + 80)}>
        <BarChart
          data={data.length > 0 ? data : [{ name: "No data", clicks: 0, leads: 0, approved: 0, spend: 0 }]}
          margin={{ top: 8, right: 12, left: 0, bottom: 48 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-24}
            textAnchor="end"
            height={60}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              if (name === moneyLabel || name === "Spend" || name === "spend") {
                return [`$${n.toFixed(2)}`, moneyLabel];
              }
              return [n.toLocaleString(), String(name)];
            }}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="clicks" name="Clicks" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="approved" name="Approved" fill="#22C55E" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="spend" name={moneyLabel} fill="#F97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Full-width horizontal geo bars */
export function ReportsGeoChart({ rows }: { rows: GeoBreakdownRow[] }) {
  const data = rows.slice(0, 12).map((row) => ({
    country: row.country,
    leads: row.leads,
    approved: row.approvedLeads,
    spend: row.spend,
  }));

  return (
    <ChartCard title="Geographic performance" description="Leads and approvals by country">
      <ResponsiveContainer width="100%" height={Math.max(280, Math.max(data.length, 1) * 32 + 40)}>
        <BarChart
          layout="vertical"
          data={data.length > 0 ? data : [{ country: "No data", leads: 0, approved: 0, spend: 0 }]}
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="country"
            width={88}
            tick={{ fontSize: 12, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle()} />
          <Legend />
          <Bar dataKey="leads" name="Leads" fill="#8B5CF6" radius={[0, 6, 6, 0]} barSize={14} />
          <Bar dataKey="approved" name="Approved" fill="#22C55E" radius={[0, 6, 6, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Status donut + conversion funnel side panel */
export function ReportsStatusAndFunnel({
  statusMix,
  funnel,
  hideRejected = false,
}: {
  statusMix: LeadsStatusMixItem[];
  funnel: { clicks: number; leads: number; approved: number; rejected: number };
  hideRejected?: boolean;
}) {
  const visibleMix = hideRejected
    ? statusMix.filter((item) => item.name !== "Rejected")
    : statusMix;
  const pieData =
    visibleMix.length > 0
      ? visibleMix.map((item) => ({
          ...item,
          color: STATUS_COLORS[item.name] ?? BAR_PALETTE[0],
        }))
      : [{ name: "No data", value: 1, color: STATUS_COLORS["No data"] }];

  const funnelSteps = [
    { label: "Clicks", value: funnel.clicks, color: "#0EA5E9" },
    { label: "Leads", value: funnel.leads, color: "#8B5CF6" },
    { label: "Approved", value: funnel.approved, color: "#22C55E" },
    ...(!hideRejected
      ? [{ label: "Rejected", value: funnel.rejected, color: "#EF4444" }]
      : []),
  ];
  const maxFunnel = Math.max(...funnelSteps.map((step) => step.value), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Lead status mix" description="Share of leads by current status">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((entry, i) => (
                <Cell key={entry.name} fill={entry.color ?? BAR_PALETTE[i % BAR_PALETTE.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle()} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-4">
          {pieData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600">{item.name}</span>
              <span className="font-semibold text-slate-900">{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      <ChartCard
        title="Conversion funnel"
        description="Click → lead → approved flow for the selected period"
      >
        <div className="flex h-[300px] flex-col justify-center gap-5 px-1">
          {funnelSteps.map((step) => {
            const pct = Math.max(6, Math.round((step.value / maxFunnel) * 100));
            return (
              <div key={step.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">{step.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {step.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: step.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}

/** Full-width horizontal ranking for publishers/advertisers */
export function ReportsEntityRankChart({
  title,
  description,
  data,
  valueLabel,
}: {
  title: string;
  description?: string;
  data: Array<{ name: string; value: number }>;
  valueLabel: string;
}) {
  const rows = data.slice(0, 10);
  return (
    <ChartCard title={title} description={description}>
      <ResponsiveContainer width="100%" height={Math.max(280, Math.max(rows.length, 1) * 34 + 40)}>
        <BarChart
          layout="vertical"
          data={rows.length > 0 ? rows : [{ name: "No data", value: 0 }]}
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 12, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value) => [Number(value ?? 0).toLocaleString(), valueLabel]}
          />
          <Bar dataKey="value" name={valueLabel} radius={[0, 8, 8, 0]} barSize={18}>
            {(rows.length > 0 ? rows : [{ name: "No data", value: 0 }]).map((_, i) => (
              <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ReportsAnalyticsBoard({
  activity,
  campaigns,
  geo,
  statusMix,
  funnel,
  entityRank,
  hideRejected = false,
}: {
  activity: ActivityTrendPoint[];
  campaigns: CampaignPerformanceRow[];
  geo: GeoBreakdownRow[];
  statusMix: LeadsStatusMixItem[];
  funnel: { clicks: number; leads: number; approved: number; rejected: number };
  entityRank?: {
    title: string;
    description?: string;
    data: Array<{ name: string; value: number }>;
    valueLabel: string;
  };
  hideRejected?: boolean;
}) {
  return (
    <div className="space-y-4">
      <ReportsActivityTrendChart data={activity} />
      <ReportsCampaignCompareChart rows={campaigns} />
      <ReportsStatusAndFunnel statusMix={statusMix} funnel={funnel} hideRejected={hideRejected} />
      <ReportsGeoChart rows={geo} />
      {entityRank ? (
        <ReportsEntityRankChart
          title={entityRank.title}
          description={entityRank.description}
          data={entityRank.data}
          valueLabel={entityRank.valueLabel}
        />
      ) : null}
    </div>
  );
}
