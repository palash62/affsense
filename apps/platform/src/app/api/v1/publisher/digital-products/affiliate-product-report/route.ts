import { withAuth, parsePagination } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { digitalProductClickListQuerySchema } from "@/lib/validations";
import { listDigitalProductAffiliateProductReportForPublisher } from "@/services/digital-product.service";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const parsed = digitalProductClickListQuerySchema.safeParse({
        q: searchParams.get("q") ?? undefined,
        productId: searchParams.get("productId") ?? undefined,
        subId: searchParams.get("subId") ?? undefined,
        src: searchParams.get("src") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
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

      const data = await listDigitalProductAffiliateProductReportForPublisher(
        session.user.id,
        {
          q: parsed.data.q,
          productId: parsed.data.productId,
          subId: parsed.data.subId,
          src: parsed.data.src,
          from: parsed.data.from,
          to: parsed.data.to,
          page: parsed.data.page,
          limit: parsed.data.limit,
        },
      );
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}
