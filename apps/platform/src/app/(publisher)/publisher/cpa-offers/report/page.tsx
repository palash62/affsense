import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { PublisherCpaOffersReport } from "@/components/publisher/cpa-offers/publisher-cpa-offers-report";

export const dynamic = "force-dynamic";

export default async function PublisherCpaOffersReportPage() {
  const session = await getSession();
  if (!session?.user?.id || !isPublisherPortalRole(session.user.role)) {
    redirect("/login");
  }

  return <PublisherCpaOffersReport />;
}
