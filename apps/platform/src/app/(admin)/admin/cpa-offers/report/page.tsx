import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminCpaOffersReport } from "@/components/admin/admin-cpa-offers-report";

export const dynamic = "force-dynamic";

export default async function AdminCpaOffersReportPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <AdminCpaOffersReport />;
}
