import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { approveCampaign, rejectCampaign } from "@/services/admin.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const campaignId = body.campaignId as string | undefined;
      const action = body.action as "approve" | "reject" | undefined;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";

      if (!campaignId || !action) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid request", status: 422 } },
          { status: 422 },
        );
      }

      if (action === "approve") {
        const campaign = await approveCampaign(campaignId, session.user.id);
        return Response.json({ data: campaign });
      }

      if (!reason) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Rejection note is required", status: 422 } },
          { status: 422 },
        );
      }

      const campaign = await rejectCampaign(campaignId, session.user.id, reason);
      return Response.json({ data: campaign });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
