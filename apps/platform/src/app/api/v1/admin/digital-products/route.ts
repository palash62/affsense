import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  createDigitalProduct,
  listDigitalProducts,
} from "@/services/digital-product.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const data = await listDigitalProducts({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      page,
      limit,
    });
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const data = await createDigitalProduct(body);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
