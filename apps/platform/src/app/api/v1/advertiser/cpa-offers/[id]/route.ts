import { withAuth } from "@/lib/api-handler";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { errorResponse, Errors } from "@/lib/errors";
import { getActiveCpaOfferForAdvertiserOwner } from "@/services/cpa-offer.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async (session) => {
    try {
      if (!canAdvertiserAccessCpaOffers(session.user.email)) {
        throw Errors.notFound("CPA offer");
      }
      const data = await getActiveCpaOfferForAdvertiserOwner(id, session.user.id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
