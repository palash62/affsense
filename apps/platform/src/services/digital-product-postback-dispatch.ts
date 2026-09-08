import { substitutePostbackMacros, type PostbackMacroContext } from "@cpl/shared";
import { assertSafeOutboundUrl } from "@cpl/tracking-core";
import { extractOrderFieldsFromClickFunnelsPayload } from "@/lib/clickfunnels-webhook-payload";
import { prisma } from "@/lib/prisma";

const FETCH_TIMEOUT_MS = 4_000;
const RESPONSE_TRUNCATE = 500;
const URL_TRUNCATE = 4_000;
const PUBLISHER_COMMISSION_RATE = 0.5;

export type DigitalProductPostbackFireResult = {
  url: string;
  ok: boolean;
  httpStatus: number;
  error: string | null;
  skipped?: boolean;
  reason?: string;
};

function isHttpTemplateUrl(endpoint: string): boolean {
  const withoutMacros = endpoint.replace(/\{[a-z0-9_]+\}/gi, "placeholder");
  try {
    const parsed = new URL(withoutMacros);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function fireHttpGet(url: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const safe = await assertSafeOutboundUrl(url);
    const res = await fetch(safe.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "LeadVix-DigitalProduct-Postback/1.0" },
    });
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status };
    }
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: body.slice(0, RESPONSE_TRUNCATE) || `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function recordDelivery(input: {
  publisherId: string;
  webhookEventId: string;
  postbackId?: string | null;
  url: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  httpStatus?: number | null;
  error?: string | null;
  payout?: number | null;
}) {
  try {
    await prisma.digitalProductPostbackDelivery.upsert({
      where: { webhookEventId: input.webhookEventId },
      create: {
        publisherId: input.publisherId,
        webhookEventId: input.webhookEventId,
        postbackId: input.postbackId ?? null,
        url: input.url.slice(0, URL_TRUNCATE),
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        error: input.error?.slice(0, RESPONSE_TRUNCATE) ?? null,
        payout: input.payout ?? null,
        attempts: 1,
      },
      update: {
        url: input.url.slice(0, URL_TRUNCATE),
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        error: input.error?.slice(0, RESPONSE_TRUNCATE) ?? null,
        payout: input.payout ?? null,
        attempts: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("[digital-product-postback] failed to record delivery", error);
  }
}

function buildMacroContext(input: {
  publisherId: string;
  webhookEventId: string;
  orderId: string | null;
  productId: string | null;
  payout: number;
  source: string | null;
  subId: string | null;
}): PostbackMacroContext {
  const clickId = input.orderId || input.webhookEventId;
  return {
    clickId,
    leadId: input.webhookEventId,
    payout: String(input.payout),
    currency: "USD",
    affId: input.publisherId,
    affEid: input.publisherId,
    offerId: input.productId,
    source: input.source,
    date: new Date().toISOString().slice(0, 10),
    sub1: input.subId,
  };
}

/** Fire publisher S2S postback once for a processed digital-product sale. */
export async function dispatchDigitalProductPublisherPostback(
  webhookEventId: string,
): Promise<DigitalProductPostbackFireResult | null> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: {
      id: true,
      status: true,
      eventType: true,
      publisherId: true,
      payloadJson: true,
    },
  });

  if (!event || event.status !== "PROCESSED" || !event.publisherId) {
    return null;
  }

  const fields = extractOrderFieldsFromClickFunnelsPayload(event.payloadJson);
  const type = (fields.orderType ?? event.eventType ?? "").toLowerCase();
  if (type.includes("refund")) {
    return {
      url: "",
      ok: false,
      httpStatus: 0,
      error: "Refund events do not fire publisher postbacks.",
      skipped: true,
      reason: "refund",
    };
  }

  const existing = await prisma.digitalProductPostbackDelivery.findUnique({
    where: { webhookEventId: event.id },
  });
  if (existing) {
    return {
      url: existing.url,
      ok: existing.status === "SUCCESS",
      httpStatus: existing.httpStatus ?? 0,
      error: existing.error,
      skipped: true,
      reason: "already-delivered",
    };
  }

  const postback = await prisma.publisherPostback.findUnique({
    where: {
      publisherId_channel: {
        publisherId: event.publisherId,
        channel: "DIGITAL_PRODUCT",
      },
    },
  });
  if (!postback || postback.status !== "ACTIVE" || !postback.endpoint.trim()) {
    return null;
  }

  const amount = fields.amount ?? 0;
  const payout = Math.round(amount * PUBLISHER_COMMISSION_RATE * 100) / 100;
  const context = buildMacroContext({
    publisherId: event.publisherId,
    webhookEventId: event.id,
    orderId: fields.orderId,
    productId: fields.product,
    payout,
    source: fields.source,
    subId: fields.subId,
  });

  if (!isHttpTemplateUrl(postback.endpoint)) {
    const result: DigitalProductPostbackFireResult = {
      url: postback.endpoint,
      ok: false,
      httpStatus: 0,
      error: "Postback URL must start with http:// or https://",
      skipped: true,
      reason: "invalid-url",
    };
    await recordDelivery({
      publisherId: event.publisherId,
      webhookEventId: event.id,
      postbackId: postback.id,
      url: postback.endpoint,
      status: "SKIPPED",
      error: result.error,
      payout,
    });
    return result;
  }

  const url = substitutePostbackMacros(postback.endpoint, context);
  const fired = await fireHttpGet(url);
  await recordDelivery({
    publisherId: event.publisherId,
    webhookEventId: event.id,
    postbackId: postback.id,
    url,
    status: fired.ok ? "SUCCESS" : "FAILED",
    httpStatus: fired.status || null,
    error: fired.error ?? null,
    payout,
  });

  return {
    url,
    ok: fired.ok,
    httpStatus: fired.status,
    error: fired.error ?? null,
  };
}
