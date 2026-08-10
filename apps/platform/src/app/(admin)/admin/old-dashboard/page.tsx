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

export default async function AdminOldDashboardPage() {
  const session = await getSession();
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }
  const data = await getAdminControlCenterData(session.user.id);
  const firstName = session.user.name?.split(" ")[0] ?? "Admin";

  return (
    <div className="space-y-5">
      <AdminWelcomeSummary
        userName={firstName}
        platformStatus={data.platformStatus}
        summary={data.summary}
      />
      <AdminActionCenter items={data.actionItems} />
      <AdminBusinessOverviewStats data={data.businessOverview} />
      <AdminRevenueOverview revenue={data.revenue} />
      <AdminProfitOverview adminProfit={data.adminProfit} />
      <AdminPendingApprovalCenter lanes={data.approvalLanes} />
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
      <AdminTopPerformers data={data.topPerformers} />
      <AdminPlatformHealthPanel
        health={data.platformHealth}
        pendingPayouts={data.summary.pendingWithdrawals}
        openTickets={data.summary.openTickets}
      />
    </div>
  );
}
