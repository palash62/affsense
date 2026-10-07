export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { BarChart3, DollarSign, MousePointerClick, Percent, Target, TrendingUp } from "lucide-react";
import { getSession } from "@/lib/session";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { parsePerformanceSource } from "@/lib/publisher-performance";
import { getPublisherPerformanceReport } from "@/services/publisher-dashboard.service";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency } from "@/components/admin/admin-ui";
import { PublisherPerformanceFilters } from "@/components/publisher/reports/publisher-performance-filters";
import { PublisherPerformanceChart } from "@/components/publisher/reports/publisher-performance-chart";
import { PublisherPerformanceTable } from "@/components/publisher/reports/publisher-performance-table";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; source?: string }>;
}

export default async function PublisherPerformanceReportPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!isPublisherPortalRole(session.user.role)) notFound();

  const params = await searchParams;
  const defaultFrom = defaultCampaignDateFrom();
  const defaultTo = defaultCampaignDateTo();
  const from = new Date(`${params.from ?? defaultFrom}T00:00:00`);
  const to = new Date(`${params.to ?? defaultTo}T23:59:59`);
  const source = parsePerformanceSource(params.source);

  const { kpis, series } = await getPublisherPerformanceReport(session.user.id, { from, to, source });

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Reports"
        title="Performance"
        description="Daily clicks, conversions and earnings across CPA offers and digital products."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <NeutralStatCard
          label="Clicks"
          value={kpis.clicks.toLocaleString("en-US")}
          icon={MousePointerClick}
          accent="green"
        />
        <NeutralStatCard
          label="Conversions"
          value={kpis.conversions.toLocaleString("en-US")}
          icon={Target}
          accent="purple"
        />
        <NeutralStatCard label="CR%" value={`${kpis.cr.toFixed(2)}%`} icon={Percent} accent="orange" />
        <NeutralStatCard label="EPC" value={formatCurrency(kpis.epc)} icon={TrendingUp} accent="green" />
        <GradientStatCard
          label="Earnings"
          value={formatCurrency(kpis.earnings)}
          icon={DollarSign}
          variant="revenue"
        />
      </div>

      <PublisherPerformanceChart series={series} />

      <PageSection
        title="Daily breakdown"
        description={`${series.length} day${series.length === 1 ? "" : "s"} in range`}
        icon={BarChart3}
        contentClassName="p-0"
      >
        <Suspense>
          <PublisherPerformanceFilters defaultFrom={defaultFrom} defaultTo={defaultTo} />
        </Suspense>
        <PublisherPerformanceTable series={series} totals={kpis} />
      </PageSection>
    </div>
  );
}
