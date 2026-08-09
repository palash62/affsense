import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminCpaOffersReport } from "@/components/admin/admin-cpa-offers-report";
import { listDepositAdvertiserOptions } from "@/services/wallet.service";

export const dynamic = "force-dynamic";

export default async function AdminCpaOffersReportPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  const advertisers = await listDepositAdvertiserOptions();

  return <AdminCpaOffersReport advertisers={advertisers} />;
}
