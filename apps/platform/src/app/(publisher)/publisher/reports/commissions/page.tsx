export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import {
  DollarSign,
  LayoutGrid,
  Percent,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { getPublisherCommissionReport } from "@/services/digital-product.service";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";
import { PublisherCommissionFilters } from "@/components/publisher/reports/publisher-commission-filters";
import { PublisherCommissionCharts } from "@/components/publisher/reports/publisher-commission-charts";
import { PublisherCommissionTable } from "@/components/publisher/reports/publisher-commission-table";

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    product?: string;
    orderType?: string;
    source?: string;
    subId?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function PublisherCommissionsReportPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!isPublisherPortalRole(session.user.role)) notFound();

  const params = await searchParams;
  const defaultFrom = defaultCampaignDateFrom();
  const defaultTo = defaultCampaignDateTo();
  const from = params.from ? new Date(params.from) : new Date(defaultFrom);
  const to = params.to ? new Date(`${params.to}T23:59:59`) : new Date(`${defaultTo}T23:59:59`);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const report = await getPublisherCommissionReport({
    publisherId: session.user.id,
    from,
    to,
    product: params.product,
    orderType: params.orderType,
    source: params.source,
    subId: params.subId,
    status: params.status,
    q: params.q,
    page,
    limit: 10,
  });

  const {
    kpis,
    series,
    typeSlices,
    productSlices,
    items,
    total,
    page: currentPage,
    totalPages,
    filterOptions,
  } = report;

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Reports"
        title="Commissions Report"
        description="View all your earnings, sales and commissions in detail."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GradientStatCard
          label="Orders"
          value={kpis.orders.toLocaleString()}
          icon={ShoppingCart}
          variant="leads"
        />
        <GradientStatCard
          label="Sales"
          value={formatUsd(kpis.sales)}
          icon={DollarSign}
          variant="revenue"
        />
        <GradientStatCard
          label="Commission"
          value={formatUsd(kpis.commission)}
          icon={Percent}
          variant="approved"
        />
        <NeutralStatCard
          label="Refunds"
          value={formatUsd(kpis.refunds)}
          icon={RefreshCcw}
          accent="red"
        />
        <NeutralStatCard
          label="Front End"
          value={kpis.frontEndCount.toLocaleString()}
          icon={LayoutGrid}
          accent="purple"
        />
        <NeutralStatCard
          label="Upsells"
          value={kpis.upsellCount.toLocaleString()}
          icon={Sparkles}
          accent="orange"
        />
      </div>

      <PublisherCommissionCharts
        series={series}
        typeSlices={typeSlices}
        productSlices={productSlices}
        commissionTotal={kpis.commission}
      />

      <PageSection
        title="Commissions breakdown"
        description={`${total.toLocaleString()} attributed sale${total === 1 ? "" : "s"} in range`}
        icon={Percent}
      >
        <Suspense>
          <PublisherCommissionFilters
            products={filterOptions.products}
            sources={filterOptions.sources}
            subIds={filterOptions.subIds}
            defaultFrom={defaultFrom}
            defaultTo={defaultTo}
          />
        </Suspense>
        <PublisherCommissionTable rows={items} />
        <Suspense>
          <AdvertiserLeadsTableFooter
            page={currentPage}
            totalPages={totalPages}
            total={total}
            perPage={10}
          />
        </Suspense>
      </PageSection>
    </div>
  );
}
