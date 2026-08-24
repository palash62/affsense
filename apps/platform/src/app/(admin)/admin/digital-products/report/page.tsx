export const dynamic = "force-dynamic";

import { Suspense } from "react";
import {
  BarChart3,
  DollarSign,
  RefreshCcw,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { listDigitalProductOrders } from "@/services/digital-product.service";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { DigitalProductOrderFilters } from "@/components/admin/digital-products/digital-product-order-filters";
import { DigitalProductOrdersTable } from "@/components/admin/digital-products/digital-product-orders-table";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";

interface PageProps {
  searchParams: Promise<{
    publisherId?: string;
    eventType?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DigitalProductsReportPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const defaultFrom = defaultCampaignDateFrom();
  const defaultTo = defaultCampaignDateTo();

  const from = params.from ? new Date(params.from) : new Date(defaultFrom);
  const to = params.to ? new Date(params.to + "T23:59:59") : new Date(defaultTo + "T23:59:59");
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [result, publishers] = await Promise.all([
    listDigitalProductOrders({
      from,
      to,
      publisherId: params.publisherId ?? undefined,
      eventType: params.eventType ?? undefined,
      page,
      limit: 15,
    }),
    prisma.user.findMany({
      where: { role: "PUBLISHER" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const { items, total, totalPages, summary } = result;

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        title="Orders Report"
        description="Track and analyze all digital product orders and affiliate generated sales."
        eyebrow="Digital Products"
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GradientStatCard
          label="Total Orders"
          value={summary.totalOrders.toLocaleString()}
          icon={ShoppingCart}
          variant="leads"
        />
        <GradientStatCard
          label="Gross Revenue"
          value={formatUsd(summary.grossRevenue)}
          icon={DollarSign}
          variant="revenue"
        />
        <GradientStatCard
          label="Affiliate Sales"
          value={summary.affiliateSales.toLocaleString()}
          icon={Users}
          variant="approved"
        />
        <NeutralStatCard
          label="Total Commissions"
          value={formatUsd(summary.totalCommissions)}
          icon={Wallet}
          accent="purple"
        />
        <NeutralStatCard
          label="Net Revenue"
          value={formatUsd(summary.netRevenue)}
          icon={TrendingUp}
          accent="green"
        />
        <NeutralStatCard
          label="Refunds"
          value={formatUsd(summary.refunds)}
          icon={RefreshCcw}
          accent="red"
        />
      </div>

      {/* Table section */}
      <PageSection
        title="Orders"
        description={`${total.toLocaleString()} webhook events in range`}
        icon={BarChart3}
      >
        <Suspense>
          <DigitalProductOrderFilters
            publishers={publishers}
            defaultFrom={defaultFrom}
            defaultTo={defaultTo}
          />
        </Suspense>

        <DigitalProductOrdersTable rows={items} />

        <AdvertiserLeadsTableFooter
          page={page}
          totalPages={totalPages}
          total={total}
          perPage={15}
        />
      </PageSection>
    </div>
  );
}
