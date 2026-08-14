import { withAuth, parsePagination } from "@/lib/api-handler";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { advertiserCpaOfferCreateSchema, cpaOfferListQuerySchema } from "@/lib/validations";
import { createCpaOffer, listActiveCpaOffers } from "@/services/cpa-offer.service";
import { prisma } from "@/lib/prisma";
import { parseCpaOfferDetails } from "@/lib/cpa-offer-details";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    if (!canAdvertiserAccessCpaOffers(session.user.email)) {
      return Response.json({
        data: {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 1,
        },
      });
    }

    const parsed = cpaOfferListQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      id: searchParams.get("id") ?? undefined,
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

    const data = await listActiveCpaOffers(parsed.data);
    return Response.json({ data });
  }, ["ADVERTISER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (!canAdvertiserAccessCpaOffers(session.user.email)) {
      return Response.json(
        {
          error: {
            code: "PERMISSION_DENIED",
            message: "CPA offers are not available for this account",
            status: 403,
          },
        },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = advertiserCpaOfferCreateSchema.safeParse(body);
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        advertiserProfile: { select: { company: true } },
      },
    });

    const details = parseCpaOfferDetails(parsed.data.details);
    const data = await createCpaOffer({
      ...parsed.data,
      advertiserLabel: user?.advertiserProfile?.company || user?.name || "Advertiser",
      createdByUserId: session.user.id,
      details: { ...details, publishRequested: details.publishRequested === true },
      status: "PAUSED",
    });

    return Response.json({ data }, { status: 201 });
  }, ["ADVERTISER"]);
}
