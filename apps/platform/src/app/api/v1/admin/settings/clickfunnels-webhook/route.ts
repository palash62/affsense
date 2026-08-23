import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  getClickFunnelsWebhookSettingsForAdmin,
  updateClickFunnelsWebhookSettings,
  getWebhookActivitySummary,
} from "@/services/clickfunnels-webhook-settings.service";

export async function GET() {
  return withAuth(async () => {
    const [data, summary] = await Promise.all([
      getClickFunnelsWebhookSettingsForAdmin(),
      getWebhookActivitySummary(),
    ]);
    return Response.json({ data: { ...data, summary } });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const data = await updateClickFunnelsWebhookSettings(
        {
          enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
          name: typeof body.name === "string" ? body.name : undefined,
          affiliateTrackingParam:
            typeof body.affiliateTrackingParam === "string"
              ? body.affiliateTrackingParam
              : undefined,
          webhookSecret:
            typeof body.webhookSecret === "string" ? body.webhookSecret : undefined,
          regenerateSecret: body.regenerateSecret === true,
          secretHeaderName:
            typeof body.secretHeaderName === "string" ? body.secretHeaderName : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
        },
        session.user.id,
      );
      const summary = await getWebhookActivitySummary();
      return Response.json({ data: { ...data, summary } });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
