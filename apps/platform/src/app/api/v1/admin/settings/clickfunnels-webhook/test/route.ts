import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse, Errors } from "@/lib/errors";
import { handleClickFunnelsWebhookPost } from "@/lib/handle-clickfunnels-webhook";
import {
  loadClickFunnelsWebhookConfig,
  createWebhookEvent,
  listWebhookActivity,
} from "@/services/clickfunnels-webhook-settings.service";
import { sanitizeWebhookPayload } from "@/lib/clickfunnels-webhook-settings";

export async function POST() {
  return withAuth(async () => {
    try {
      const config = await loadClickFunnelsWebhookConfig();
      if (!config.enabled) {
        throw Errors.validation("ClickFunnels webhooks are disabled. Enable them first.");
      }
      if (!config.webhookSecret.trim()) {
        throw Errors.validation("Generate or set a webhook secret before testing.");
      }

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

      // In-process call — avoid self-fetching public HTTPS (breaks behind TLS-terminating proxy).
      const internalRequest = new Request("http://127.0.0.1/api/v1/webhooks/clickfunnels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [config.secretHeaderName]: config.webhookSecret,
        },
        body: JSON.stringify(payload),
      });

      const res = await handleClickFunnelsWebhookPost(internalRequest);
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
