import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { getOfferWallListForRequest } from "@/lib/offer-wall-list";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    try {
      const data = await getOfferWallListForRequest(request, {
        affSub4: session.user.id,
        applyAffiliateShare: true,
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}
