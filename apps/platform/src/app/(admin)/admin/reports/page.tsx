import { Suspense } from "react";
import Link from "next/link";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import { BarChart3, Globe2 } from "lucide-react";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import {
  getActivityTrendInRange,
  getAdminReportsBreakdown,
  getAdminReportsOverview,
  getCampaignPerformanceReport,
  getFraudReportSnapshot,
  getGeoLeadBreakdown,
  getLeadsStatusMix,
  type AdminEntityReportRow,
} from "@/services/report.service";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { AdminReportsFilters } from "@/components/admin/admin-reports-filters";
import {
  AdminReportsSummaryBar,
  AdminReportsTable,
} from "@/components/admin/admin-reports-table";
import { formatCurrency } from "@/components/admin/admin-ui";
import { ReportsKpiStrip } from "@/components/reports/reports-kpi-strip";
import { ReportsAnalyticsBoard } from "@/components/reports/reports-analytics-board";
import { CampaignPerformanceTable } from "@/components/reports/campaign-performance-table";
import { GeoBreakdownTable } from "@/components/reports/geo-breakdown-table";
import { AdminEntityExportButton } from "@/components/reports/admin-entity-export-button";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    view?: string;
    sort?: string;
  }>;
}

function parseSort(sort?: string): "leads" | "clicks" | "conversion" | "spend" {
  if (sort === "clicks" || sort === "conversion" || sort === "spend") return sort;
  return "leads";
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function sumVisibleRows(rows: AdminEntityReportRow[]) {
  const totals = rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      leads: acc.leads + row.leads,
      approvedLeads: acc.approvedLeads + row.approvedLeads,
      rejectedLeads: acc.rejectedLeads + row.rejectedLeads,
      pendingLeads: acc.pendingLeads + row.pendingLeads,
      salesCount: acc.salesCount + row.salesCount,
      revenue: acc.revenue + row.revenue,
      spend: acc.spend + row.spend,
      earnings: acc.earnings + row.earnings,
    }),
    {
      clicks: 0,
      leads: 0,
      approvedLeads: 0,
      rejectedLeads: 0,
      pendingLeads: 0,
      salesCount: 0,
      revenue: 0,
      spend: 0,
      earnings: 0,
    },
  );
  return {
    ...totals,
    revenue: Math.round(totals.revenue * 100) / 100,
    conversionRate: totals.clicks > 0 ? Math.round((totals.leads / totals.clicks) * 10000) / 100 : 0,
    approvalRate: totals.leads > 0 ? Math.round((totals.approvedLeads / totals.leads) * 10000) / 100 : 0,
  };
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const fromStr = params.from ?? defaultCampaignDateFrom();
  const toStr = params.to ?? defaultCampaignDateTo();
  const from = startOfDay(parseISO(fromStr));
  const to = endOfDay(parseISO(toStr));
  const view = params.view === "advertisers" ? "advertisers" : "publishers";
  const mode = view === "advertisers" ? "advertiser" : "publisher";

  const [overview, breakdown, statusMix, campaigns, geo, fraud, activity] = await Promise.all([
    getAdminReportsOverview({ from, to }),
    getAdminReportsBreakdown({
      search: params.q,
      from,
      to,
      sort: parseSort(params.sort),
    }),
    getLeadsStatusMix({ from, to }),
    getCampaignPerformanceReport({ from, to }),
    getGeoLeadBreakdown({ from, to, limit: 12 }),
    getFraudReportSnapshot({ from, to }),
    getActivityTrendInRange({ from, to }),
  ]);

  const rows = view === "advertisers" ? breakdown.advertisers : breakdown.publishers;
  const visibleTotals = sumVisibleRows(rows);

  const topEntities = rows.slice(0, 10).map((row) => ({
    name: row.name.length > 18 ? `${row.name.slice(0, 18)}…` : row.name,
    value: mode === "publisher" ? row.earnings : row.spend || row.leads,
  }));

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Analytics"
        title="Platform Reports"
        description="Platform-wide KPIs, trends, and account performance for the selected date range"
        badge={`${formatPercent(overview.conversionRate)} conv.`}
      />

      <ReportsKpiStrip
        items={[
          { label: "Clicks", value: overview.clicks.toLocaleString(), variant: "leads", icon: "clicks" },
          { label: "Leads", value: overview.leads.toLocaleString(), variant: "leads", icon: "leads" },
          { label: "Approved", value: overview.approvedLeads.toLocaleString(), variant: "approved", icon: "approved" },
          { label: "Advertiser spend", value: formatCurrency(overview.spend), variant: "revenue", icon: "spend" },
          { label: "Publisher earnings", value: formatCurrency(overview.earnings), variant: "revenue", icon: "spend" },
          { label: "Platform fees", value: formatCurrency(overview.platformFees), variant: "revenue", icon: "spend" },
          { label: "Admin profit", value: formatCurrency(overview.profit), variant: "approved", icon: "spend" },
          {
            label: "Pending payouts",
            value: `${overview.pendingPayoutCount} · ${formatCurrency(overview.pendingPayoutAmount)}`,
            icon: "accounts",
          },
        ]}
      />

      <ReportsAnalyticsBoard
        activity={activity}
        campaigns={campaigns}
        geo={geo}
        statusMix={statusMix}
        funnel={{
          clicks: overview.clicks,
          leads: overview.leads,
          approved: overview.approvedLeads,
          rejected: overview.rejectedLeads,
        }}
        entityRank={{
          title: mode === "publisher" ? "Top publishers" : "Top advertisers",
          description:
            mode === "publisher"
              ? "Highest earnings in the selected range"
              : "Highest spend / lead volume in the selected range",
          data: topEntities,
          valueLabel: mode === "publisher" ? "Earnings" : "Spend / leads",
        }}
      />

      <div className="premium-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Fraud snapshot</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {fromStr} to {toStr}
            </p>
          </div>
          <Link
            href="/admin/fraud"
            className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
          >
            Open fraud center
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FraudStat label="Avg risk score" value={String(fraud.avgRiskScore)} />
          <FraudStat label="High-risk leads" value={fraud.highRiskLeads.toLocaleString()} />
          <FraudStat label="Rejected leads" value={fraud.rejectedLeads.toLocaleString()} />
          <FraudStat label="Duplicate flags" value={fraud.duplicateFlags.toLocaleString()} />
          <FraudStat label="Disposable emails" value={fraud.disposableEmails.toLocaleString()} />
          <FraudStat label="Approval rate" value={formatPercent(overview.approvalRate)} />
        </div>
      </div>

      <PageSection
        title={view === "advertisers" ? "Advertiser performance" : "Publisher performance"}
        description={`${fromStr} to ${toStr}`}
        icon={BarChart3}
        gradient="leads"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-muted-foreground">Loading filters...</div>}>
          <AdminReportsFilters />
        </Suspense>

        <div className="flex justify-end border-b border-border px-4 py-3 sm:px-6">
          <AdminEntityExportButton
            rows={rows}
            mode={mode}
            filename={`admin-${mode}-reports.csv`}
          />
        </div>

        <AdminReportsSummaryBar totals={visibleTotals} rowCount={rows.length} mode={mode} />
        <AdminReportsTable rows={rows} mode={mode} />
      </PageSection>

      <PageSection
        title="Campaign performance"
        description="Platform-wide campaign clicks, leads, and spend"
        icon={BarChart3}
        gradient="revenue"
      >
        <CampaignPerformanceTable rows={campaigns} exportFilename="admin-campaigns.csv" />
      </PageSection>

      <PageSection
        title="Geo breakdown"
        description="Lead volume and spend by country"
        icon={Globe2}
        gradient="approved"
      >
        <GeoBreakdownTable rows={geo} exportFilename="admin-geo.csv" />
      </PageSection>
    </div>
  );
}

function FraudStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/80 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
