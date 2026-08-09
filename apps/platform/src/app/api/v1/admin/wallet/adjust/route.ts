import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { adjustWallet } from "@/services/admin.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const { userId, amount, type, reason } = body;

      if (!userId || !amount || !["CREDIT", "DEBIT"].includes(type)) {
        return Response.json({ error: { code: "VALIDATION_ERROR", status: 422 } }, { status: 422 });
      }

      await adjustWallet(userId, Number(amount), type, reason ?? "Admin adjustment", session.user.id);
      return Response.json({ success: true });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
