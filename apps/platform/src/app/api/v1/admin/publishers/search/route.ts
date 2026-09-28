import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { searchPublishersForCommissionPlan } from "@/services/commission-plan.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const q = (searchParams.get("q") ?? "").slice(0, 120);
      const data = await searchPublishersForCommissionPlan(q, 20);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
