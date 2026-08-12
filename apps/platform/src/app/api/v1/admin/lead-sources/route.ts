import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { listDistinctLeadSources } from "@/services/lead.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const advertiserId = searchParams.get("advertiserId")?.trim();
    const campaignId = searchParams.get("campaignId")?.trim();
    const publisherId = searchParams.get("publisherId")?.trim();

    const data = await listDistinctLeadSources({
      advertiserId: advertiserId || undefined,
      campaignId: campaignId || undefined,
      publisherId: publisherId || undefined,
      dateFrom: new Date(searchParams.get("from") ?? defaultCampaignDateFrom()),
      dateTo: new Date(searchParams.get("to") ?? defaultCampaignDateTo()),
      search: searchParams.get("search") ?? undefined,
    });

    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
