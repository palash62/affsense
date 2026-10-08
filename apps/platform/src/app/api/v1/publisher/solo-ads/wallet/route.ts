import { withAuth } from "@/lib/api-handler";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { getSoloWalletSummary } from "@/services/solo-wallet.service";

export async function GET() {
  return withAuth(async (session) => {
    await requireSoloAdsAccess(session.user.id);
    return Response.json({ data: await getSoloWalletSummary(session.user.id) });
  }, ["PUBLISHER"]);
}
