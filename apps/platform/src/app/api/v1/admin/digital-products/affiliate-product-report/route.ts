import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { digitalProductClickListQuerySchema } from "@/lib/validations";
import { listDigitalProductAffiliateProductReportForAdmin } from "@/services/digital-product.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const parsed = digitalProductClickListQuerySchema.safeParse({
        q: searchParams.get("q") ?? undefined,
        productId: searchParams.get("productId") ?? undefined,
        publisherId: searchParams.get("publisherId") ?? undefined,
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

      const data = await listDigitalProductAffiliateProductReportForAdmin(parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
