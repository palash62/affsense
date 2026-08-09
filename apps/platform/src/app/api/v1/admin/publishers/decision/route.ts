import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { approvePublisher, rejectPublisher } from "@/services/admin.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const userId = body.userId as string | undefined;
      const action = body.action as "approve" | "reject" | undefined;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";

      if (!userId || !action) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid request", status: 422 } },
          { status: 422 },
        );
      }

      if (action === "approve") {
        const user = await approvePublisher(userId, session.user.id);
        return Response.json({ data: user });
      }

      if (!reason) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Rejection note is required", status: 422 } },
          { status: 422 },
        );
      }

      const user = await rejectPublisher(userId, session.user.id, reason);
      return Response.json({ data: user });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
