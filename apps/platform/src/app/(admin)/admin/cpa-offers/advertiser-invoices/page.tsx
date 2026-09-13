import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminAdvertiserCpaInvoicesPanel } from "@/components/admin/admin-advertiser-cpa-invoices-panel";

export const dynamic = "force-dynamic";

export default async function AdminAdvertiserCpaInvoicesPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return <AdminAdvertiserCpaInvoicesPanel />;
}
