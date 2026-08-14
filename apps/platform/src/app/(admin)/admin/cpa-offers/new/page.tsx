import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CpaOfferEditor } from "@/components/cpa/cpa-offer-editor";

export const dynamic = "force-dynamic";

export default async function AdminCpaOfferNewPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <CpaOfferEditor role="ADMIN" mode="create" advertiserLabelDefault="Platform" />;
}
