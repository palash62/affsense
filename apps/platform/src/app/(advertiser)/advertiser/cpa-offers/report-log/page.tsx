import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { AdvertiserCpaOffersReportLog } from "@/components/advertiser/advertiser-cpa-offers-report-log";

export const dynamic = "force-dynamic";

export default async function AdvertiserCpaOffersReportLogPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADVERTISER") {
    redirect("/login");
  }

  if (!canAdvertiserAccessCpaOffers(session.user.email)) {
    redirect("/advertiser/cpa-offers");
  }

  return <AdvertiserCpaOffersReportLog />;
}
