import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminCpaOfferForm } from "@/components/admin/admin-cpa-offer-form";

export const dynamic = "force-dynamic";

export default async function AdminCpaOfferNewPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <AdminCpaOfferForm mode="create" />;
}
