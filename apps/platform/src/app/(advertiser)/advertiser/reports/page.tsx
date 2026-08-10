import { Suspense } from "react";
import Link from "next/link";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import { BarChart3, Globe2, Users } from "lucide-react";
import { getSession } from "@/lib/session";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { listAdvertiserPublisherLeadReport } from "@/services/lead.service";
import {
  getActivityTrendInRange,
  getAdvertiserReportsMetrics,
  getCampaignPerformanceReport,
  getGeoLeadBreakdown,
  getLeadsStatusMix,
} from "@/services/report.service";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/admin/page-section";
import { formatCurrency } from "@/components/admin/admin-ui";
import { ReportsPeriodFilters } from "@/components/reports/reports-period-filters";
import { ReportsKpiStrip } from "@/components/reports/reports-kpi-strip";
import { ReportsAnalyticsBoard } from "@/components/reports/reports-analytics-board";
import { CampaignPerformanceTable } from "@/components/reports/campaign-performance-table";
import { PublisherPerformanceTable } from "@/components/reports/publisher-performance-table";
import { GeoBreakdownTable } from "@/components/reports/geo-breakdown-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function AdvertiserReportsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const advertiserId = session!.user!.id;
  const params = await searchParams;
  const fromStr = params.from ?? defaultCampaignDateFrom();
  const toStr = params.to ?? defaultCampaignDateTo();
  const from = startOfDay(parseISO(fromStr));
  const to = endOfDay(parseISO(toStr));

  const [metrics, statusMix, activity, campaigns, publishers, geo] = await Promise.all([
    getAdvertiserReportsMetrics(advertiserId, from, to),
    getLeadsStatusMix({ advertiserId, from, to }),
    getActivityTrendInRange({ advertiserId, from, to }),
    getCampaignPerformanceReport({ advertiserId, from, to }),
    listAdvertiserPublisherLeadReport({
      advertiserId,
      dateFrom: from,
      dateTo: to,
    }),
    getGeoLeadBreakdown({ advertiserId, from, to }),
  ]);

  const publisherRank = publishers.slice(0, 10).map((row) => ({
    name: row.publisherId.length > 10 ? `${row.publisherId.slice(0, 8)}…` : row.publisherId,
    value: row.totalLeads,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign Reports"
        description={`Performance analytics from ${fromStr} to ${toStr}`}
      >
        <Link
          href="/advertiser/lead-report"
          className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
        >
          Publisher lead report
        </Link>
      </PageHeader>

      <PageSection
        title="Date range"
        description="Filter all metrics, charts, and tables below"
        icon={BarChart3}
        gradient="leads"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-muted-foreground">Loading filters...</div>}>
          <ReportsPeriodFilters />
        </Suspense>
      </PageSection>

      <ReportsKpiStrip
        items={[
          { label: "Active campaigns", value: metrics.activeCampaigns.toLocaleString(), icon: "accounts" },
          { label: "Clicks", value: metrics.clicks.toLocaleString(), variant: "leads", icon: "clicks" },
          { label: "Leads", value: metrics.leads.toLocaleString(), variant: "leads", icon: "leads" },
          { label: "Approved", value: metrics.approvedLeads.toLocaleString(), variant: "approved", icon: "approved" },
          { label: "Rejected", value: metrics.rejectedLeads.toLocaleString(), icon: "rejected" },
          { label: "Spend", value: formatCurrency(metrics.spend), variant: "revenue", icon: "spend" },
          { label: "Avg CPL", value: formatCurrency(metrics.cpl), variant: "revenue", icon: "spend" },
          { label: "Conversion", value: `${metrics.conversionRate.toFixed(2)}%`, icon: "conversion" },
        ]}
      />

      <ReportsAnalyticsBoard
        activity={activity}
        campaigns={campaigns}
        geo={geo}
        statusMix={statusMix}
        funnel={{
          clicks: metrics.clicks,
          leads: metrics.leads,
          approved: metrics.approvedLeads,
          rejected: metrics.rejectedLeads,
        }}
        entityRank={{
          title: "Top publishers by leads",
          description: "Highest-volume publishers in this range",
          data: publisherRank,
          valueLabel: "Leads",
        }}
      />

      <PageSection
        title="Campaign performance"
        description="Clicks, leads, approval rate, and spend by campaign"
        icon={BarChart3}
        gradient="revenue"
      >
        <CampaignPerformanceTable rows={campaigns} exportFilename="advertiser-campaigns.csv" />
      </PageSection>

      <PageSection
        title="Publisher performance"
        description="Lead volume and estimated spend by publisher ID"
        icon={Users}
        gradient="approved"
      >
        <PublisherPerformanceTable rows={publishers} exportFilename="advertiser-publishers.csv" />
      </PageSection>

      <PageSection
        title="Geo breakdown"
        description="Lead volume and spend by country"
        icon={Globe2}
        gradient="leads"
      >
        <GeoBreakdownTable rows={geo} exportFilename="advertiser-geo.csv" />
      </PageSection>
    </div>
  );
}
