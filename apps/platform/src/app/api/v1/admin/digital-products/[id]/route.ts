import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  deleteDigitalProduct,
  getDigitalProductById,
  updateDigitalProduct,
} from "@/services/digital-product.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async () => {
    try {
      const data = await getDigitalProductById(id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async () => {
    try {
      const body = await request.json();
      const data = await updateDigitalProduct(id, body);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async () => {
    try {
      const data = await deleteDigitalProduct(id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
