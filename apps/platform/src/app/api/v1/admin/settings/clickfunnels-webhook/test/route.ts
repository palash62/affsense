import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse, Errors } from "@/lib/errors";
import {
  loadClickFunnelsWebhookConfig,
  createWebhookEvent,
  listWebhookActivity,
} from "@/services/clickfunnels-webhook-settings.service";
import { sanitizeWebhookPayload } from "@/lib/clickfunnels-webhook-settings";

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const config = await loadClickFunnelsWebhookConfig();
      if (!config.enabled) {
        throw Errors.validation("ClickFunnels webhooks are disabled. Enable them first.");
      }
      if (!config.webhookSecret.trim()) {
        throw Errors.validation("Generate or set a webhook secret before testing.");
      }

      const origin = new URL(request.url).origin;
      const payload = {
        event: "test",
        source: "affsense_admin_test",
        contact: {
          email: "test@affsense.local",
          name: "Webhook Test",
        },
        [config.affiliateTrackingParam]: "TEST_AFFILIATE",
        sentAt: new Date().toISOString(),
      };

      const res = await fetch(`${origin}/api/v1/webhooks/clickfunnels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [config.secretHeaderName]: config.webhookSecret,
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        await createWebhookEvent({
          eventType: "test.failed",
          status: "FAILED",
          leadEmail: "test@affsense.local",
          leadName: "Webhook Test",
          errorMessage: body?.error?.message ?? `Test returned HTTP ${res.status}`,
          payloadJson: sanitizeWebhookPayload(payload),
        });
        return Response.json(
          {
            error: {
              code: "TEST_FAILED",
              message: body?.error?.message ?? `Test returned HTTP ${res.status}`,
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const activity = await listWebhookActivity({ page: 1, limit: 10 });
      return Response.json({
        data: {
          ok: true,
          message: "Test event processed successfully",
          summary: activity.summary,
        },
      });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
