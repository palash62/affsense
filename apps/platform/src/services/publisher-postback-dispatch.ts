import type { CpaPostbackDeliveryStatus, PublisherPostbackEvent } from "@prisma/client";
import { substitutePostbackMacros, type PostbackMacroContext } from "@cpl/shared";
import { assertSafeOutboundUrl } from "@cpl/tracking-core";
import { prisma } from "@/lib/prisma";
import { getLeadCpl } from "@/lib/lead-cpl";
import { calculatePublisherPayout } from "@/lib/platform-settings";
import { getPlatformSettingsConfig } from "@/lib/platform-settings-server";

const FETCH_TIMEOUT_MS = 4_000;
const RESPONSE_TRUNCATE = 500;
const URL_TRUNCATE = 4_000;

export type PublisherPostbackFireResult = {
  url: string;
  ok: boolean;
  httpStatus: number;
  error: string | null;
  skipped?: boolean;
  reason?: string;
};

export function buildPublisherPostbackMacroContext(input: {
  leadId: string;
  publisherId: string;
  campaignId: string;
  payout: string | number | null;
  source?: string | null;
  subId?: string | null;
  date?: string | null;
}): PostbackMacroContext {
  return {
    clickId: input.leadId,
    leadId: input.leadId,
    payout: input.payout != null ? String(input.payout) : "",
    currency: "USD",
    affId: input.publisherId,
    offerId: input.campaignId,
    source: input.source ?? null,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    sub1: input.subId ?? null,
  };
}

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
      headers: { "User-Agent": "LeadVix-Publisher-Postback/1.0" },
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
  leadId?: string | null;
  postbackId?: string | null;
  url: string;
  event: PublisherPostbackEvent;
  status: CpaPostbackDeliveryStatus;
  httpStatus?: number | null;
  error?: string | null;
  payout?: number | null;
}) {
  try {
    if (input.leadId) {
      const existing = await prisma.publisherPostbackDelivery.findUnique({
        where: { leadId: input.leadId },
      });
      if (existing) {
        await prisma.publisherPostbackDelivery.update({
          where: { id: existing.id },
          data: {
            url: input.url.slice(0, URL_TRUNCATE),
            status: input.status,
            httpStatus: input.httpStatus ?? null,
            error: input.error?.slice(0, RESPONSE_TRUNCATE) ?? null,
            payout: input.payout ?? existing.payout,
            attempts: { increment: 1 },
          },
        });
        return;
      }
    }

    await prisma.publisherPostbackDelivery.create({
      data: {
        publisherId: input.publisherId,
        leadId: input.leadId ?? null,
        postbackId: input.postbackId ?? null,
        url: input.url.slice(0, URL_TRUNCATE),
        event: input.event,
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        error: input.error?.slice(0, RESPONSE_TRUNCATE) ?? null,
        payout: input.payout ?? null,
        attempts: 1,
      },
    });
  } catch (error) {
    console.error("[publisher-postback] failed to record delivery", error);
  }
}

async function fireAndRecord(input: {
  publisherId: string;
  leadId?: string | null;
  postbackId?: string | null;
  endpoint: string;
  event: PublisherPostbackEvent;
  context: PostbackMacroContext;
  payout?: number | null;
}): Promise<PublisherPostbackFireResult> {
  if (!isHttpTemplateUrl(input.endpoint)) {
    const result: PublisherPostbackFireResult = {
      url: input.endpoint,
      ok: false,
      httpStatus: 0,
      error: "Postback URL must start with http:// or https://",
      skipped: true,
      reason: "invalid-url",
    };
    await recordDelivery({
      publisherId: input.publisherId,
      leadId: input.leadId,
      postbackId: input.postbackId,
      url: input.endpoint,
      event: input.event,
      status: "SKIPPED",
      error: result.error,
      payout: input.payout ?? null,
    });
    return result;
  }

  const url = substitutePostbackMacros(input.endpoint, input.context);
  const fired = await fireHttpGet(url);
  await recordDelivery({
    publisherId: input.publisherId,
    leadId: input.leadId,
    postbackId: input.postbackId,
    url,
    event: input.event,
    status: fired.ok ? "SUCCESS" : "FAILED",
    httpStatus: fired.status || null,
    error: fired.error ?? null,
    payout: input.payout ?? null,
  });

  return {
    url,
    ok: fired.ok,
    httpStatus: fired.status,
    error: fired.error ?? null,
  };
}

/** Fire the publisher S2S postback once when a lead is paid. */
export async function dispatchPublisherPostback(leadId: string): Promise<PublisherPostbackFireResult | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      publisherId: true,
      campaignId: true,
      source: true,
      subId: true,
      country: true,
      cpl: true,
      isTest: true,
      status: true,
      campaign: { select: { cpl: true } },
    },
  });

  if (!lead || lead.isTest) {
    return null;
  }

  const existing = await prisma.publisherPostbackDelivery.findUnique({
    where: { leadId: lead.id },
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
    where: { publisherId: lead.publisherId },
  });
  if (!postback || postback.status !== "ACTIVE" || !postback.endpoint.trim()) {
    return null;
  }

  const settings = await getPlatformSettingsConfig();
  const cpl = getLeadCpl(lead);
  const { publisherAmount } = calculatePublisherPayout(cpl, lead.country, settings);

  return fireAndRecord({
    publisherId: lead.publisherId,
    leadId: lead.id,
    postbackId: postback.id,
    endpoint: postback.endpoint,
    event: "PAID",
    payout: publisherAmount,
    context: buildPublisherPostbackMacroContext({
      leadId: lead.id,
      publisherId: lead.publisherId,
      campaignId: lead.campaignId,
      payout: publisherAmount,
      source: lead.source,
      subId: lead.subId,
    }),
  });
}

export async function firePublisherPostbackTest(input: {
  publisherId: string;
  endpoint?: string;
}): Promise<PublisherPostbackFireResult> {
  const saved = await prisma.publisherPostback.findUnique({
    where: { publisherId: input.publisherId },
  });
  const endpoint = (input.endpoint ?? saved?.endpoint ?? "").trim();
  if (!endpoint) {
    return {
      url: "",
      ok: false,
      httpStatus: 0,
      error: "Save a postback URL before testing.",
      skipped: true,
      reason: "missing-endpoint",
    };
  }

  return fireAndRecord({
    publisherId: input.publisherId,
    leadId: null,
    postbackId: saved?.id ?? null,
    endpoint,
    event: "TEST",
    payout: 1,
    context: buildPublisherPostbackMacroContext({
      leadId: "test-lead-id",
      publisherId: input.publisherId,
      campaignId: "test-campaign-id",
      payout: 1,
      source: "test",
      subId: "test-sub",
    }),
  });
}
