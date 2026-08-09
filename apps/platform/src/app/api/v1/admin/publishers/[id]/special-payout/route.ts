import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { serializePublisherSpecialTierPayouts } from "@/lib/publisher-special-payout";
import { adminPublisherSpecialPayoutSchema } from "@/lib/validations";
import { updatePublisherSpecialPayout } from "@/services/admin.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = adminPublisherSpecialPayoutSchema.safeParse(body);

      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Invalid special payout";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const profile = await updatePublisherSpecialPayout(id, parsed.data, session.user.id);
      return Response.json({
        data: serializePublisherSpecialTierPayouts(profile),
      });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
