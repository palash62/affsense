import { withAuth } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { rotateSoloLeadApiKey } from "@/services/solo-tracking.service";

export async function POST() {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const data = await rotateSoloLeadApiKey(session.user.id);
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  }, ["PUBLISHER"]);
}
