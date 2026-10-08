import { withAuth } from "@/lib/api-handler";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { listSoloCampaignProviders } from "@/services/solo-campaign.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (session) => {
    await requireSoloAdsAccess(session.user.id);
    const { id } = await params;
    return Response.json({ data: await listSoloCampaignProviders(session.user.id, id) });
  }, ["PUBLISHER"]);
}
