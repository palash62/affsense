import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminTutorialsList } from "@/components/admin/admin-tutorials-list";

export const dynamic = "force-dynamic";

export default async function AdminTutorialsPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <AdminTutorialsList />;
}
