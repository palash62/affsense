import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CpaOfferCategoriesPanel } from "@/components/admin/cpa/cpa-offer-categories-panel";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function AdminCpaOfferCategoriesPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categories"
        description="Organize offer network categories."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Offer Network", href: "/admin/offer-network" },
          { label: "Categories" },
        ]}
      />
      <CpaOfferCategoriesPanel />
    </div>
  );
}
