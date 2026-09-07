export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { AdminDigitalProductsReport } from "@/components/admin/digital-products/admin-digital-products-report";

export default async function DigitalProductsReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const publishers = await prisma.user.findMany({
    where: { role: "PUBLISHER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <AdminDigitalProductsReport
      publishers={publishers}
      defaultFrom={defaultCampaignDateFrom()}
      defaultTo={defaultCampaignDateTo()}
    />
  );
}
