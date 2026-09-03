import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { requestPublisherCpaOfferAccess } from "@/services/cpa-offer.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    try {
      const { id } = await params;
      const data = await requestPublisherCpaOfferAccess(session.user.id, id);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}
