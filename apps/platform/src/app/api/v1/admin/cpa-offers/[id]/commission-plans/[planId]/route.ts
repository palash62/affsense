import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { cpaCommissionPlanUpdateSchema } from "@/lib/validations";
import {
  deleteCpaCommissionPlan,
  updateCpaCommissionPlan,
} from "@/services/commission-plan.service";

type RouteContext = { params: Promise<{ id: string; planId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id, planId } = await context.params;
  return withAuth(async () => {
    try {
      const body = await request.json();
      const parsed = cpaCommissionPlanUpdateSchema.safeParse(body);
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

      const data = await updateCpaCommissionPlan(id, planId, parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, planId } = await context.params;
  return withAuth(async () => {
    try {
      const data = await deleteCpaCommissionPlan(id, planId);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
