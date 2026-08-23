import { withAuth, ADMIN_PORTAL_ROLES, parsePagination } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { listWebhookActivity } from "@/services/clickfunnels-webhook-settings.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const data = await listWebhookActivity({ page, limit });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
