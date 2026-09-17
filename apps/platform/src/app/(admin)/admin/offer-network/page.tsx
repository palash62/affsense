import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminCpaOffersList } from "@/components/admin/admin-cpa-offers-list";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function OfferNetworkPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Offer Network"
        description="Browse and manage network CPA offers."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Offer Network" },
        ]}
      />
      <AdminCpaOffersList />
    </div>
  );
}
