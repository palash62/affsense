import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { cpaOfferAccessRequestListQuerySchema } from "@/lib/validations";
import { listCpaOfferAccessRequests } from "@/services/cpa-offer.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const parsed = cpaOfferAccessRequestListQuerySchema.safeParse({
      status: searchParams.get("status") ?? "PENDING",
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

    const data = await listCpaOfferAccessRequests(parsed.data);
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
