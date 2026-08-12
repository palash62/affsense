import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { adminPromotionUpdateSchema } from "@/lib/validations";
import { updatePromotion } from "@/services/promotion.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    try {
      const { id } = await context.params;
      const body = await request.json();
      const parsed = adminPromotionUpdateSchema.safeParse(body);
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

      const data = await updatePromotion(id, parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
