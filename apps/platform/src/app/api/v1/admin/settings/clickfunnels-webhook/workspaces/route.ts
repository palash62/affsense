import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { listClickFunnelsWorkspaces } from "@/services/clickfunnels-api.service";
import { loadClickFunnelsWebhookConfig } from "@/services/clickfunnels-webhook-settings.service";

/** List workspaces for a new token (body.apiToken) or the saved one. */
export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = (await request.json().catch(() => ({}))) as { apiToken?: unknown };
      const provided = typeof body.apiToken === "string" ? body.apiToken.trim() : "";
      const token = provided || (await loadClickFunnelsWebhookConfig()).apiToken;
      const data = await listClickFunnelsWorkspaces(token);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
