import { isAdminPortalRole } from "@/lib/admin-portal";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AdminCpaOffersReport } from "@/components/admin/admin-cpa-offers-report";
import { listDepositAdvertiserOptions } from "@/services/wallet.service";

export const dynamic = "force-dynamic";

export default async function AdminCpaOffersReportLogPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  const [advertisers, publishers] = await Promise.all([
    listDepositAdvertiserOptions(),
    prisma.user.findMany({
      where: { role: "PUBLISHER" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <AdminCpaOffersReport advertisers={advertisers} publishers={publishers} />;
}
