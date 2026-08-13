import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  deleteGetPaidTask,
  getGetPaidTaskById,
  updateGetPaidTask,
} from "@/services/get-paid-task.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async () => {
    try {
      const data = await getGetPaidTaskById(id);
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
      const data = await updateGetPaidTask(id, body);
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
      const data = await deleteGetPaidTask(id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
