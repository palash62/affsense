"use client";

import { DashboardToolbar } from "./dashboard-toolbar";
import { KpiCards } from "./kpi-cards";
import { LatestAnnouncementsCard } from "./latest-announcements-card";
import { PayoutRequestsCard } from "./payout-requests-card";
import { RecentSignupsCard } from "./recent-signups-card";
import { RecentTransactionsCard } from "./recent-transactions-card";
import { RevenueOverviewCard } from "./revenue-overview-card";
import { SalesBySourceCard } from "./sales-by-source-card";
import { TopSellingProductsCard } from "./top-selling-products-card";

export function AffsenseAdminDashboard() {
  return (
    <div className="space-y-5">
      <DashboardToolbar />
      <KpiCards />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <RevenueOverviewCard />
        </div>
        <div className="xl:col-span-4">
          <SalesBySourceCard />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <RecentTransactionsCard />
        </div>
        <div className="xl:col-span-3">
          <RecentSignupsCard />
        </div>
        <div className="xl:col-span-3">
          <TopSellingProductsCard />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <PayoutRequestsCard />
        </div>
        <div className="xl:col-span-4">
          <LatestAnnouncementsCard />
        </div>
      </div>
    </div>
  );
}
