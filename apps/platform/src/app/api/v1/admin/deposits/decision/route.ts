import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { approveDeposit, rejectDeposit } from "@/services/wallet.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const depositId = body.depositId as string | undefined;
      const action = body.action as "approve" | "reject" | undefined;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";

      if (!depositId || !action) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid request", status: 422 } },
          { status: 422 },
        );
      }

      if (action === "approve") {
        const deposit = await approveDeposit(depositId, session.user.id);
        return Response.json({ data: deposit });
      }

      if (!reason) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Rejection note is required", status: 422 } },
          { status: 422 },
        );
      }

      const deposit = await rejectDeposit(depositId, session.user.id, reason);
      return Response.json({ data: deposit });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
