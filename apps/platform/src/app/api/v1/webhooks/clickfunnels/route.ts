import { loadClickFunnelsWebhookConfig, createWebhookEvent, resolvePublisherFromAffiliateRef } from "@/services/clickfunnels-webhook-settings.service";
import { sanitizeWebhookPayload } from "@/lib/clickfunnels-webhook-settings";
import { extractAffiliateRefFromWebhookPayload } from "@/lib/clickfunnels-webhook-attribution";

function extractSecret(
  request: Request,
  body: unknown,
  headerName: string,
): string | null {
  const candidates = [
    headerName,
    "X-Affsense-Secret",
    "X-Webhook-Secret",
    "x-affsense-secret",
    "x-webhook-secret",
  ];
  for (const name of candidates) {
    const value = request.headers.get(name);
    if (value?.trim()) return value.trim();
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret?.trim()) return querySecret.trim();

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["webhook_secret", "secret", "webhookSecret"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseLeadFields(body: unknown): {
  eventType: string;
  leadEmail: string | null;
  leadName: string | null;
} {
  if (!body || typeof body !== "object") {
    return { eventType: "webhook", leadEmail: null, leadName: null };
  }
  const record = body as Record<string, unknown>;
  const nested =
    record.contact && typeof record.contact === "object"
      ? (record.contact as Record<string, unknown>)
      : record;

  const eventType =
    pickString(record, ["event", "event_type", "eventType", "type", "status"]) ??
    "purchase";
  const leadEmail = pickString(nested, ["email", "Email", "buyer_email", "customer_email"]);
  const first = pickString(nested, ["first_name", "firstName"]);
  const last = pickString(nested, ["last_name", "lastName"]);
  const combined = [first, last].filter(Boolean).join(" ");
  const leadName =
    pickString(nested, ["name", "full_name", "fullName", "buyer_name"]) ??
    (combined || null);

  return {
    eventType,
    leadEmail,
    leadName,
  };
}

async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return await request.json();
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      return Object.fromEntries(form.entries());
    }
    const text = await request.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text.slice(0, 2000) };
    }
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  const sanitized = sanitizeWebhookPayload(body);
  const requestUrl = new URL(request.url);

  async function logEvent(input: {
    eventType: string;
    status: "PROCESSED" | "FAILED" | "IGNORED" | "DUPLICATE";
    leadEmail?: string | null;
    leadName?: string | null;
    errorMessage?: string | null;
    config?: Awaited<ReturnType<typeof loadClickFunnelsWebhookConfig>>;
  }) {
    const affiliateRef = extractAffiliateRefFromWebhookPayload(
      body,
      input.config?.affiliateTrackingParam ?? "affsense_id",
      requestUrl,
    );
    const attribution = await resolvePublisherFromAffiliateRef(affiliateRef);
    await createWebhookEvent({
      eventType: input.eventType,
      status: input.status,
      leadEmail: input.leadEmail,
      leadName: input.leadName,
      errorMessage: input.errorMessage,
      publisherId: attribution.publisherId,
      affiliateRef: attribution.affiliateRef,
      payloadJson: sanitized,
    });
  }

  try {
    const config = await loadClickFunnelsWebhookConfig();

    if (!config.enabled) {
      const lead = parseLeadFields(body);
      await logEvent({
        eventType: lead.eventType || "webhook.disabled",
        status: "IGNORED",
        leadEmail: lead.leadEmail,
        leadName: lead.leadName,
        errorMessage: "ClickFunnels webhooks are disabled",
        config,
      });
      return Response.json(
        {
          error: {
            code: "WEBHOOK_DISABLED",
            message: "ClickFunnels webhooks are disabled",
            status: 503,
          },
        },
        { status: 503 },
      );
    }

    const expected = config.webhookSecret.trim();
    if (!expected) {
      const lead = parseLeadFields(body);
      await logEvent({
        eventType: lead.eventType || "webhook.not_configured",
        status: "FAILED",
        leadEmail: lead.leadEmail,
        leadName: lead.leadName,
        errorMessage: "Platform webhook secret is not configured",
        config,
      });
      return Response.json(
        {
          error: {
            code: "WEBHOOK_NOT_CONFIGURED",
            message: "Platform webhook secret is not configured",
            status: 422,
          },
        },
        { status: 422 },
      );
    }

    const provided = extractSecret(request, body, config.secretHeaderName);
    if (!provided || provided !== expected) {
      const lead = parseLeadFields(body);
      await logEvent({
        eventType: lead.eventType || "webhook.unauthorized",
        status: "FAILED",
        leadEmail: lead.leadEmail,
        leadName: lead.leadName,
        errorMessage: "Invalid webhook secret",
        config,
      });
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid webhook secret", status: 401 } },
        { status: 401 },
      );
    }

    const lead = parseLeadFields(body);
    await logEvent({
      eventType: lead.eventType,
      status: "PROCESSED",
      leadEmail: lead.leadEmail,
      leadName: lead.leadName,
      config,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[clickfunnels-webhook] error", error);
    try {
      const config = await loadClickFunnelsWebhookConfig();
      await logEvent({
        eventType: "webhook.error",
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Webhook processing failed",
        config,
      });
    } catch {
      // ignore secondary log failure
    }
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Webhook processing failed", status: 500 } },
      { status: 500 },
    );
  }
}
