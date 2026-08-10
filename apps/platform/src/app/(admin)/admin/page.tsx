import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AffsenseAdminDashboard } from "@/components/admin/affsense-dashboard/affsense-admin-dashboard";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <AffsenseAdminDashboard />;
}
