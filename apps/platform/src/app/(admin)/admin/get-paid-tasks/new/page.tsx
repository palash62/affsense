import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GetPaidTaskForm } from "@/components/admin/get-paid-tasks/get-paid-task-form";

export const dynamic = "force-dynamic";

export default async function GetPaidTaskNewPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <GetPaidTaskForm />;
}
