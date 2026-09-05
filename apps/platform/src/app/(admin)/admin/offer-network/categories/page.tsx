import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CpaOfferCategoriesPanel } from "@/components/admin/cpa/cpa-offer-categories-panel";

export const dynamic = "force-dynamic";

export default async function AdminCpaOfferCategoriesPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <CpaOfferCategoriesPanel />;
}
