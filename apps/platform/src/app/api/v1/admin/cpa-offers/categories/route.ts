import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  deleteCpaOfferCategory,
  listActiveCpaOfferCategoryNames,
  listCpaOfferCategories,
  saveCpaOfferCategory,
} from "@/services/cpa-offer-category.service";

/** Admin: full list. Advertiser: ACTIVE names only (for offer editor select). */
export async function GET() {
  return withAuth(async (session) => {
    if (session.user.role === "ADVERTISER") {
      const names = await listActiveCpaOfferCategoryNames();
      return Response.json({
        data: names.map((name) => ({
          id: name,
          name,
          status: "Active" as const,
          offerCount: 0,
        })),
      });
    }
    const data = await listCpaOfferCategories();
    return Response.json({ data });
  }, [...ADMIN_PORTAL_ROLES, "ADVERTISER"]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const data = await saveCpaOfferCategory(body);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}

export async function DELETE(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "id required", status: 422 } },
          { status: 422 },
        );
      }
      const data = await deleteCpaOfferCategory(id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
