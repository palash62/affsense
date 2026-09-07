import { withAuth, parsePagination } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { digitalProductClickListQuerySchema } from "@/lib/validations";
import { listDigitalProductClicksForPublisher } from "@/services/digital-product.service";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const parsed = digitalProductClickListQuerySchema.safeParse({
        q: searchParams.get("q") ?? undefined,
        productId: searchParams.get("productId") ?? undefined,
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

      const data = await listDigitalProductClicksForPublisher(session.user.id, parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}
