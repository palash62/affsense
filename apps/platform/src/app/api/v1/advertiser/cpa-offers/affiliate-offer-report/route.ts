import { withAuth, parsePagination } from "@/lib/api-handler";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { errorResponse } from "@/lib/errors";
import { cpaConversionListQuerySchema } from "@/lib/validations";
import { listCpaAffiliateOfferReportForAdvertiserOwner } from "@/services/cpa-offer.service";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    try {
      if (!canAdvertiserAccessCpaOffers(session.user.email)) {
        return Response.json({
          data: {
            items: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 1,
            stats: {
              clicks: 0,
              conversions: 0,
              conversionRate: 0,
              epc: "0.00",
              payout: "0.00",
              revenue: "0.00",
              profit: "0.00",
            },
          },
        });
      }

      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const parsed = cpaConversionListQuerySchema.safeParse({
        q: searchParams.get("q") ?? undefined,
        offerId: searchParams.get("offerId") ?? undefined,
        subId: searchParams.get("subId") ?? undefined,
        subId2: searchParams.get("subId2") ?? undefined,
        subId3: searchParams.get("subId3") ?? undefined,
        subId4: searchParams.get("subId4") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        sortBy: searchParams.get("sortBy") || undefined,
        sortDir: searchParams.get("sortDir") || undefined,
        page,
        limit,
      });

      if (!parsed.success) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error.issues[0]?.message ?? "Invalid query",
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const data = await listCpaAffiliateOfferReportForAdvertiserOwner(session.user.id, {
        q: parsed.data.q,
        offerId: parsed.data.offerId,
        subId: parsed.data.subId,
        subId2: parsed.data.subId2,
        subId3: parsed.data.subId3,
        subId4: parsed.data.subId4,
        from: parsed.data.from,
        to: parsed.data.to,
        page: parsed.data.page,
        limit: parsed.data.limit,
        sortBy: parsed.data.sortBy,
        sortDir: parsed.data.sortDir,
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
