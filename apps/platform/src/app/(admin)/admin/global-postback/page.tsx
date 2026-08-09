import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminGlobalPostbackForm } from "@/components/admin/admin-global-postback-form";

export const dynamic = "force-dynamic";

export default async function AdminGlobalPostbackPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }
  return <AdminGlobalPostbackForm />;
}
