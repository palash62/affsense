import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { cpaOfferAccessDecisionSchema } from "@/lib/validations";
import { reviewCpaOfferAccessRequest } from "@/services/cpa-offer.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    try {
      const { id } = await params;
      const body = await request.json().catch(() => null);
      const parsed = cpaOfferAccessDecisionSchema.safeParse(body);

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

      if (parsed.data.decision === "REJECTED" && !parsed.data.adminNote?.trim()) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "A rejection note is required",
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const data = await reviewCpaOfferAccessRequest(
        session.user.id,
        id,
        parsed.data.decision,
        parsed.data.adminNote,
      );
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
