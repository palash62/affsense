import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { PublisherCpaAffiliateOfferReport } from "@/components/publisher/cpa-offers/publisher-cpa-affiliate-offer-report";

export const dynamic = "force-dynamic";

export default async function PublisherCpaOffersReportPage() {
  const session = await getSession();
  if (!session?.user?.id || !isPublisherPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <PublisherCpaAffiliateOfferReport />;
}
