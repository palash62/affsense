"use client";

import { DashboardToolbar } from "./dashboard-toolbar";
import { KpiCards } from "./kpi-cards";
import { LatestAnnouncementsCard } from "./latest-announcements-card";
import { PayoutRequestsCard } from "./payout-requests-card";
import { RecentSignupsCard } from "./recent-signups-card";
import { RecentTransactionsCard } from "./recent-transactions-card";
import { RevenueOverviewCard } from "./revenue-overview-card";
import { TopSellingProductsCard } from "./top-selling-products-card";
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
      <DashboardToolbar />
      <KpiCards stats={stats} />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <RevenueOverviewCard series={stats.revenueSeries} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <RecentTransactionsCard deposits={stats.recentDeposits} />
        </div>
        <div className="xl:col-span-3">
          <RecentSignupsCard signups={stats.recentSignups} />
        </div>
        <div className="xl:col-span-3">
          <TopSellingProductsCard />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <PayoutRequestsCard payouts={stats.pendingPayouts} />
        </div>
        <div className="xl:col-span-4">
          <LatestAnnouncementsCard announcements={announcements} />
        </div>
      </div>
    </div>
  );
}
