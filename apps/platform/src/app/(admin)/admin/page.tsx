import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAdminControlCenterData } from "@/services/admin-dashboard.service";
import {
  AdminActionCenter,
  AdminBusinessOverviewStats,
  AdminPendingApprovalCenter,
  AdminPlatformHealthPanel,
  AdminProfitOverview,
  AdminRevenueOverview,
  AdminTopPerformers,
  AdminWelcomeSummary,
} from "@/components/admin/admin-control-center-sections";
import {
  AdminLeadStatusChart,
  AdminLeadsTrendChart,
  AdminPlatformBarChart,
  AdminRevenueTrendChart,
} from "@/components/admin/admin-dashboard-charts";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }
  const data = await getAdminControlCenterData(session.user.id);
  const firstName = session.user.name?.split(" ")[0] ?? "Admin";

  return (
    <div className="space-y-5">
      {/* 1. Welcome Section */}
      <AdminWelcomeSummary
        userName={firstName}
        platformStatus={data.platformStatus}
        summary={data.summary}
      />

      {/* 2. Action Center */}
      <AdminActionCenter items={data.actionItems} />

      {/* 3. Business Overview */}
      <AdminBusinessOverviewStats data={data.businessOverview} />

      {/* 4. Revenue Overview */}
      <AdminRevenueOverview revenue={data.revenue} />

      {/* 4b. Admin Profit */}
      <AdminProfitOverview adminProfit={data.adminProfit} />

      {/* 5. Pending Approval Center */}
      <AdminPendingApprovalCenter lanes={data.approvalLanes} />

      {/* 6. Business Analytics */}
      <div className="grid gap-5 lg:grid-cols-2">
        <AdminLeadsTrendChart data={data.analytics.leadsTrend} />
        <AdminRevenueTrendChart data={data.analytics.revenueTrend} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {data.analytics.leadStatusData.length > 0 && (
          <AdminLeadStatusChart data={data.analytics.leadStatusData} />
        )}
        <AdminPlatformBarChart data={data.analytics.platformData} />
      </div>

      {/* 7. Top Performers */}
      <AdminTopPerformers data={data.topPerformers} />

      {/* 8. Platform Health */}
      <AdminPlatformHealthPanel
        health={data.platformHealth}
        pendingPayouts={data.summary.pendingWithdrawals}
        openTickets={data.summary.openTickets}
      />
    </div>
  );
}
