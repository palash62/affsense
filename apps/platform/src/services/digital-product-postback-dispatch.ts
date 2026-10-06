import { substitutePostbackMacros, type PostbackMacroContext } from "@cpl/shared";
import { assertSafeOutboundUrl } from "@cpl/tracking-core";
import { extractOrderFieldsFromClickFunnelsPayload } from "@/lib/clickfunnels-webhook-payload";
import {
  applyDigitalCommissionSnapshot,
  DIGITAL_PRODUCT_FALLBACK_COMMISSION_RATE,
  loadDigitalProductCommissionLookup,
} from "@/lib/digital-product-commission";
import { prisma } from "@/lib/prisma";

const FETCH_TIMEOUT_MS = 4_000;
const RESPONSE_TRUNCATE = 500;
const URL_TRUNCATE = 4_000;

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
      headers: { "User-Agent": "Affsense-DigitalProduct-Postback/1.0" },
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
  postbackId: string;
  url: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  httpStatus?: number | null;
  error?: string | null;
  payout?: number | null;
}) {
  try {
    await prisma.digitalProductPostbackDelivery.upsert({
      where: {
        webhookEventId_postbackId: {
          webhookEventId: input.webhookEventId,
          postbackId: input.postbackId,
        },
      },
      create: {
        publisherId: input.publisherId,
        webhookEventId: input.webhookEventId,
        postbackId: input.postbackId,
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
  subId2?: string | null;
  subId3?: string | null;
  subId4?: string | null;
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
    sub2: input.subId2 ?? null,
    sub3: input.subId3 ?? null,
    sub4: input.subId4 ?? null,
  };
}

/**
 * Fire every active publisher S2S postback once for a processed digital-product sale.
 * Returns null when nothing applies, otherwise one result per active postback.
 */
export async function dispatchDigitalProductPublisherPostback(
  webhookEventId: string,
): Promise<DigitalProductPostbackFireResult[] | null> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: {
      id: true,
      status: true,
      eventType: true,
      publisherId: true,
      subId: true,
      subId2: true,
      subId3: true,
      subId4: true,
      src: true,
      payloadJson: true,
      commissionAmount: true,
      commissionRate: true,
      digitalCommissionPlanId: true,
    },
  });

  if (!event || event.status !== "PROCESSED" || !event.publisherId) {
    return null;
  }
  const publisherId = event.publisherId;

  const fields = extractOrderFieldsFromClickFunnelsPayload(event.payloadJson);
  const type = (fields.orderType ?? event.eventType ?? "").toLowerCase();
  if (type.includes("refund")) {
    return [
      {
        url: "",
        ok: false,
        httpStatus: 0,
        error: "Refund events do not fire publisher postbacks.",
        skipped: true,
        reason: "refund",
      },
    ];
  }

  const postbacks = await prisma.publisherPostback.findMany({
    where: { publisherId, channel: "DIGITAL_PRODUCT", status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const active = postbacks.filter((postback) => postback.endpoint.trim());
  if (active.length === 0) return null;

  const amount = fields.amount ?? 0;
  const lookup = await loadDigitalProductCommissionLookup();
  const resolved = applyDigitalCommissionSnapshot(lookup.resolve(fields.pageSlug, amount), event);
  const payout = resolved.commission ?? Math.round(amount * DIGITAL_PRODUCT_FALLBACK_COMMISSION_RATE * 100) / 100;
  const context = buildMacroContext({
    publisherId,
    webhookEventId: event.id,
    orderId: fields.orderId,
    productId: resolved.productId ?? fields.product,
    payout,
    source: event.src?.trim() || fields.source,
    subId: event.subId ?? fields.subId,
    subId2: event.subId2,
    subId3: event.subId3,
    subId4: event.subId4,
  });

  const results: DigitalProductPostbackFireResult[] = [];
  for (const postback of active) {
    try {
      results.push(await firePostbackOnce(publisherId, event.id, postback, context, payout));
    } catch (error) {
      console.error("[digital-product-postback] postback failed", postback.id, error);
      results.push({
        url: postback.endpoint,
        ok: false,
        httpStatus: 0,
        error: error instanceof Error ? error.message : "Dispatch failed",
      });
    }
  }
  return results;
}

async function firePostbackOnce(
  publisherId: string,
  webhookEventId: string,
  postback: { id: string; endpoint: string },
  context: PostbackMacroContext,
  payout: number,
): Promise<DigitalProductPostbackFireResult> {
  const existing = await prisma.digitalProductPostbackDelivery.findUnique({
    where: { webhookEventId_postbackId: { webhookEventId, postbackId: postback.id } },
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
      publisherId,
      webhookEventId,
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
    publisherId,
    webhookEventId,
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
