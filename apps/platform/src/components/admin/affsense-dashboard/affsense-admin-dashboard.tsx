"use client";

import { PageHeader } from "@/components/layout/page-header";
import { DashboardToolbar } from "./dashboard-toolbar";
import { EarningsOverviewCard } from "./earnings-overview-card";
import { KpiCards } from "./kpi-cards";
import { LatestAnnouncementsCard } from "./latest-announcements-card";
import { OpsStripCards } from "./ops-strip-cards";
import { PayoutRequestsCard } from "./payout-requests-card";
import { ProductMixCard } from "./product-mix-card";
import { TopCpaOffersCard } from "./top-cpa-offers-card";
import { TrafficOverviewCard } from "./traffic-overview-card";
import type { SerializedAnnouncement } from "@/services/announcement.service";
import type { AdminDashboardStats } from "@/services/admin.service";

export function AffsenseAdminDashboard({
  announcements,
  stats,
}: {
  announcements: SerializedAnnouncement[];
  stats: AdminDashboardStats;
}) {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Affsense platform overview for the last 30 days."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Dashboard" }]}
      >
        <DashboardToolbar />
      </PageHeader>

      <KpiCards stats={stats} />

      <OpsStripCards
        activeTasks={stats.activeTasks}
        pendingTaskSubmissions={stats.pendingTaskSubmissions}
        pendingCpaRequests={stats.pendingCpaRequests}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <EarningsOverviewCard series={stats.earningsSeries} />
        </div>
        <div className="xl:col-span-6">
          <TrafficOverviewCard series={stats.trafficSeries} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <ProductMixCard mix={stats.productMix} />
        </div>
        <div className="xl:col-span-4">
          <TopCpaOffersCard offers={stats.topCpaOffers} />
        </div>
        <div className="xl:col-span-4">
          <PayoutRequestsCard payouts={stats.pendingPayouts} />
        </div>
      </div>

      <LatestAnnouncementsCard announcements={announcements} />
    </div>
  );
}
