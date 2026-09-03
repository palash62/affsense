import { ADMIN_PORTAL_ROLES, withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { getOfferWallListForRequest } from "@/lib/offer-wall-list";

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const data = await getOfferWallListForRequest(request, {
        unconfiguredMessage:
          "Add the OGAds Offer API key under Platform Settings → Offer Wall.",
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
