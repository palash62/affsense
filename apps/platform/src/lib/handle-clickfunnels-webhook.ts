import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  loadClickFunnelsWebhookConfig,
  createWebhookEvent,
} from "@/services/clickfunnels-webhook-settings.service";
import { sanitizeWebhookPayload } from "@/lib/clickfunnels-webhook-settings";
import {
  CONVERSION_REJECT_REASONS,
  validateClickFunnelsConversion,
  type ConversionValidationResult,
} from "@/lib/clickfunnels-conversion-validation";
import {
  extractLeadFromClickFunnelsPayload,
  extractOrderFieldsFromClickFunnelsPayload,
} from "@/lib/clickfunnels-webhook-payload";
import { resolveDigitalProductCommissionById } from "@/lib/digital-product-commission";
import { recordDigitalProductCommission } from "@/services/wallet.service";

async function buildCommissionSnapshot(body: unknown, result: ConversionValidationResult) {
  if (result.status !== "PROCESSED" || !result.publisherId || !result.productId) return null;
  try {
    const fields = extractOrderFieldsFromClickFunnelsPayload(body);
    const resolved = await resolveDigitalProductCommissionById({
      productId: result.productId,
      upsellId: result.upsellId,
      amount: fields.amount,
      publisherId: result.publisherId,
    });
    if (resolved.matched === "fallback" || resolved.commission == null) {
      return { digitalProductId: result.productId, saleAmount: fields.amount };
    }
    return {
      digitalProductId: result.productId,
      saleAmount: fields.amount,
      commissionRate: Math.round(resolved.rate * 10000) / 100,
      commissionAmount: resolved.commission,
      digitalCommissionPlanId: resolved.planId ?? null,
    };
  } catch (error) {
    console.error("[clickfunnels-webhook] commission snapshot failed", error);
    return { digitalProductId: result.productId };
  }
}

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

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function saveSubscriptionAttribution(
  result: ConversionValidationResult,
  webhookEventId: string,
) {
  const key = result.identifiers.subscriptionKey;
  if (!result.storeSubscription || !key || !result.productId || !result.publisherId) return;
  try {
    await prisma.digitalProductSubscriptionAttribution.create({
      data: {
        cfSubscriptionId: key.slice(0, 191),
        productId: result.productId,
        upsellId: result.upsellId,
        publisherId: result.publisherId,
        clickId: result.clickId,
        subId: result.subId,
        subId2: result.subId2,
        subId3: result.subId3,
        subId4: result.subId4,
        src: result.src,
        affiliateRef: result.affiliateRef,
        originalOrderId: result.identifiers.orderId,
        originalWebhookEventId: webhookEventId,
      },
    });
  } catch (error) {
    // A concurrent delivery already stored the original attribution — keep the first one.
    if (!isUniqueViolation(error)) {
      console.error("[clickfunnels-webhook] subscription attribution save failed", error);
    }
  }
}

/** Shared ClickFunnels webhook POST handler (public route + admin in-process test). */
export async function handleClickFunnelsWebhookPost(request: Request): Promise<Response> {
  const body = await parseBody(request);
  const sanitized = sanitizeWebhookPayload(body);
  const requestUrl = new URL(request.url);
  const lead = extractLeadFromClickFunnelsPayload(body);

  async function logFailure(eventType: string, status: "FAILED" | "IGNORED", errorMessage: string) {
    return createWebhookEvent({
      eventType,
      status,
      leadEmail: lead.leadEmail,
      leadName: lead.leadName,
      errorMessage,
      payloadJson: sanitized,
    });
  }

  try {
    const config = await loadClickFunnelsWebhookConfig();

    if (!config.enabled) {
      await logFailure(
        lead.eventType || "webhook.disabled",
        "IGNORED",
        "ClickFunnels webhooks are disabled",
      );
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
      await logFailure(
        lead.eventType || "webhook.not_configured",
        "FAILED",
        "Platform webhook secret is not configured",
      );
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
      await logFailure(lead.eventType || "webhook.unauthorized", "FAILED", "Invalid webhook secret");
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid webhook secret", status: 401 } },
        { status: 401 },
      );
    }

    if (lead.eventType === "test") {
      await logFailure("test", "IGNORED", "Test event (not a conversion)");
      return Response.json({ ok: true, status: "IGNORED", reason: "TEST_EVENT" });
    }

    const result = await validateClickFunnelsConversion({
      body,
      platformParam: config.affiliateTrackingParam,
      requestUrl,
    });
    const snapshot = await buildCommissionSnapshot(body, result);
    const eventData = {
      eventType: lead.eventType,
      leadEmail: lead.leadEmail,
      leadName: lead.leadName,
      affiliateRef: result.affiliateRef,
      clickId: result.clickId,
      subId: result.subId,
      subId2: result.subId2,
      subId3: result.subId3,
      subId4: result.subId4,
      src: result.src,
      payloadJson: sanitized,
      cfProductId: result.cfProductId,
      cfOrderId: result.identifiers.orderId,
      cfSubscriptionId: result.identifiers.subscriptionKey,
      isRecurring: result.isRecurring,
    };

    if (result.status !== "PROCESSED") {
      await createWebhookEvent({
        ...eventData,
        status: "IGNORED",
        publisherId: null,
        digitalProductId: result.productId,
        errorMessage: `${result.reason}: ${CONVERSION_REJECT_REASONS[result.reason!]}`,
      });
      return Response.json({ ok: true, status: "IGNORED", reason: result.reason });
    }

    let created;
    try {
      created = await createWebhookEvent({
        ...eventData,
        ...snapshot,
        status: "PROCESSED",
        publisherId: result.publisherId,
        externalEventKey: result.externalEventKey,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await createWebhookEvent({
        ...eventData,
        status: "DUPLICATE",
        publisherId: null,
        digitalProductId: result.productId,
        errorMessage: "DUPLICATE_EVENT: This ClickFunnels payment was already recorded",
      });
      return Response.json({ ok: true, status: "DUPLICATE" });
    }

    await saveSubscriptionAttribution(result, created.id);

    if (created.publisherId) {
      // Never fail the webhook over this; the publisher reconcile retries it later.
      try {
        await recordDigitalProductCommission(created.id);
      } catch (error) {
        console.error("[clickfunnels-webhook] wallet posting failed", created.id, error);
      }
    }

    if (created.publisherId) {
      void import("@/services/digital-product-postback-dispatch")
        .then(({ dispatchDigitalProductPublisherPostback }) =>
          dispatchDigitalProductPublisherPostback(created.id),
        )
        .catch((error) => {
          console.error("[digital-product-postback] dispatch failed", created.id, error);
        });
    }

    return Response.json({ ok: true, status: "PROCESSED" });
  } catch (error) {
    console.error("[clickfunnels-webhook] error", error);
    try {
      await logFailure(
        "webhook.error",
        "FAILED",
        error instanceof Error ? error.message : "Webhook processing failed",
      );
    } catch {
      // ignore secondary log failure
    }
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Webhook processing failed", status: 500 } },
      { status: 500 },
    );
  }
}
