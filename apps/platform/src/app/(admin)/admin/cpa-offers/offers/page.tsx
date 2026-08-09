import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminCpaOffersList } from "@/components/admin/admin-cpa-offers-list";

export const dynamic = "force-dynamic";

export default async function AdminCpaOffersListPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <AdminCpaOffersList />;
}
