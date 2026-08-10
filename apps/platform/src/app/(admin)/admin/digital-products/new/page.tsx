import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DigitalProductForm } from "@/components/admin/digital-products/digital-product-form";

export const dynamic = "force-dynamic";

export default async function DigitalProductNewPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <DigitalProductForm />;
}
