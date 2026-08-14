import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  adminCpaOfferCreateSchema,
  cpaOfferListQuerySchema,
} from "@/lib/validations";
import {
  createCpaOffer,
  listCpaOffersForAdmin,
} from "@/services/cpa-offer.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const parsed = cpaOfferListQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      id: searchParams.get("id") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      network: searchParams.get("network") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      country: searchParams.get("country") ?? undefined,
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

    const data = await listCpaOffersForAdmin(parsed.data);
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = adminCpaOfferCreateSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error.issues[0]?.message ?? "Invalid input",
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const data = await createCpaOffer({
        ...parsed.data,
        createdByUserId: session.user.id,
      });
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
