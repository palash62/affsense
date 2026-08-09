import { withAuth } from "@/lib/api-handler";
import { isAdminPortalRole } from "@/lib/admin-portal";
import {
  getAdminDashboardStats,
  getAdvertiserDashboardStats,
  getPublisherDashboardStats,
} from "@/services/report.service";

export async function GET() {
  return withAuth(async (session) => {
    let stats;

    switch (session.user.role) {
      case "ADMIN":
      case "PLATFORM_MANAGER":
        stats = await getAdminDashboardStats();
        break;
      case "ADVERTISER":
        stats = await getAdvertiserDashboardStats(session.user.id);
        break;
      case "PUBLISHER":
        stats = await getPublisherDashboardStats(session.user.id);
        break;
      default:
        stats = {};
    }

    return Response.json({ data: stats });
  });
}
