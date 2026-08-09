import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { approvePayout, rejectPayout } from "@/services/payout.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const payoutId = body.payoutId as string | undefined;
      const action = body.action as "approve" | "reject" | undefined;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";

      if (!payoutId || !action) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid request", status: 422 } },
          { status: 422 },
        );
      }

      if (action === "approve") {
        const payout = await approvePayout(payoutId, session.user.id);
        return Response.json({ data: payout });
      }

      if (!reason) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Rejection note is required", status: 422 } },
          { status: 422 },
        );
      }

      const payout = await rejectPayout(payoutId, session.user.id, reason);
      return Response.json({ data: payout });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
