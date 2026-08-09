import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse, Errors } from "@/lib/errors";
import { createManualDeposit } from "@/services/wallet.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (session.impersonatorId) {
      return errorResponse(Errors.forbidden());
    }

    try {
      const body = await request.json();
      const userId = body?.userId as string | undefined;
      const amount = Number(body?.amount);
      const note = typeof body?.note === "string" ? body.note.trim() : "";

      if (!userId) {
        return errorResponse(Errors.validation("userId is required", "userId"));
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return errorResponse(Errors.validation("amount must be greater than 0", "amount"));
      }
      if (!note) {
        return errorResponse(Errors.validation("note is required", "note"));
      }

      const deposit = await createManualDeposit(session.user.id, userId, amount, note);
      return Response.json({ data: deposit }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
