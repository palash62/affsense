import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { PublisherMarketplaceAffiliateReport } from "@/components/publisher/marketplace/publisher-marketplace-affiliate-report";

export const dynamic = "force-dynamic";

export default async function PublisherMarketplaceReportPage() {
  const session = await getSession();
  if (!session || session.user.role !== "PUBLISHER") redirect("/login");

  return (
    <PublisherMarketplaceAffiliateReport
      defaultFrom={defaultCampaignDateFrom()}
      defaultTo={defaultCampaignDateTo()}
    />
  );
}
