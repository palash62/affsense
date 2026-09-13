import { withAuth, parsePagination } from "@/lib/api-handler";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { errorResponse } from "@/lib/errors";
import { listAdvertiserCpaInvoicesForAdvertiser } from "@/services/advertiser-cpa-invoice.service";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    try {
      if (!canAdvertiserAccessCpaOffers(session.user.email)) {
        return Response.json({
          data: { items: [], total: 0, page: 1, limit: 20, totalPages: 1 },
        });
      }

      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const data = await listAdvertiserCpaInvoicesForAdvertiser(session.user.id, {
        page,
        limit,
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
