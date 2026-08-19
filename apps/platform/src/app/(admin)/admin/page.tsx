import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AffsenseAdminDashboard } from "@/components/admin/affsense-dashboard/affsense-admin-dashboard";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { getAdminDashboardStats } from "@/services/admin.service";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  const [announcements, stats] = await Promise.all([
    listPublishedAnnouncements("ALL", 6),
    getAdminDashboardStats(),
  ]);

  return <AffsenseAdminDashboard announcements={announcements} stats={stats} />;
}
