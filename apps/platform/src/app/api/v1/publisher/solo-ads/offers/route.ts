import { withAuth } from "@/lib/api-handler";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { listSoloEligibleOffers } from "@/services/solo-campaign.service";

export async function GET() {
  return withAuth(async (session) => {
    await requireSoloAdsAccess(session.user.id);
    return Response.json({ data: await listSoloEligibleOffers(session.user.id) });
  }, ["PUBLISHER"]);
}
