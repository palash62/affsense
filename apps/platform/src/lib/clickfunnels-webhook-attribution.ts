import { prisma } from "@/lib/prisma";
import {
  asRecord,
  collectClickFunnelsUrlCandidates,
  extractOrderFieldsFromClickFunnelsPayload,
  extractParamFromUrl,
  pickString,
} from "./clickfunnels-webhook-payload";
import { loadDigitalProductCommissionLookup } from "./digital-product-commission";
import { resolvePublisherFromAffiliateRef } from "@/services/clickfunnels-webhook-settings.service";

export const DIGITAL_PRODUCT_CLICK_ATTRIBUTION_WINDOW_MS = 48 * 60 * 60 * 1000;

export const DEFAULT_AFFILIATE_PARAM_ALIASES = [
  "affsense_id",
  "aff_id",
  "pub_id",
] as const;

function collectRecords(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  const records: Record<string, unknown>[] = [record];

  for (const key of ["contact", "purchase", "order", "customer", "data"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      records.push(nested as Record<string, unknown>);
      // Classic CF: data.order.contact
      const nestedOrder = asRecord((nested as Record<string, unknown>).order);
      if (nestedOrder) {
        records.push(nestedOrder);
        const nestedContact = asRecord(nestedOrder.contact);
        if (nestedContact) records.push(nestedContact);
      }
      const nestedContact = asRecord((nested as Record<string, unknown>).contact);
      if (nestedContact) records.push(nestedContact);
    }
  }

  const customFields = record.custom_fields ?? record.customFields ?? record.attributes;
  if (customFields && typeof customFields === "object" && !Array.isArray(customFields)) {
    records.push(customFields as Record<string, unknown>);
  }

  return records;
}

/** Unique param names to try when extracting affiliate refs from CF payloads. */
export function buildAffiliateParamCandidates(
  primary?: string | null,
  extras: Array<string | null | undefined> = [],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [primary, ...extras, ...DEFAULT_AFFILIATE_PARAM_ALIASES]) {
    const key = raw?.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out.length > 0 ? out : ["affsense_id"];
}

/**
 * Extract affiliate tracking value from a ClickFunnels-style webhook payload.
 * Supports direct fields and Classic visit landing_page URLs (?affsense_id=...).
 */
export function extractAffiliateRefFromWebhookPayload(
  body: unknown,
  paramName: string | string[],
  requestUrl?: URL,
): string | null {
  const paramNames = Array.isArray(paramName)
    ? buildAffiliateParamCandidates(paramName[0], paramName.slice(1))
    : buildAffiliateParamCandidates(paramName);

  if (requestUrl) {
    for (const key of paramNames) {
      for (const candidate of [key, key.toLowerCase(), key.toUpperCase()]) {
        const fromQuery = requestUrl.searchParams.get(candidate);
        if (fromQuery?.trim()) return fromQuery.trim();
      }
    }
  }

  for (const record of collectRecords(body)) {
    for (const key of paramNames) {
      const keys = [key, key.toLowerCase(), key.toUpperCase()];
      const direct = pickString(record, keys);
      if (direct) return direct;
    }
  }

  for (const urlLike of collectClickFunnelsUrlCandidates(body)) {
    for (const key of paramNames) {
      const fromUrl = extractParamFromUrl(urlLike, key);
      if (fromUrl) return fromUrl;
    }
  }

  return null;
}

export async function loadDigitalProductAffiliateParamNames(): Promise<string[]> {
  const products = await prisma.digitalProduct.findMany({
    where: { affiliateTrackingParam: { not: null } },
    select: { affiliateTrackingParam: true },
    take: 200,
  });
  return products
    .map((p) => p.affiliateTrackingParam)
    .filter((v): v is string => Boolean(v?.trim()));
}

/**
 * Resolve publisher from webhook payload; fall back to recent DigitalProductClick
 * for the matched product when the tracking param is missing from CF.
 * Also attach clickId / subId / src from the matched click for reporting.
 */
export type DigitalProductWebhookAttribution = {
  publisherId: string | null;
  affiliateRef: string | null;
  clickId: string | null;
  subId: string | null;
  src: string | null;
};

export async function resolveDigitalProductWebhookAttribution(input: {
  body: unknown;
  platformParam?: string | null;
  requestUrl?: URL;
  at?: Date;
}): Promise<DigitalProductWebhookAttribution> {
  const productParams = await loadDigitalProductAffiliateParamNames();
  const paramNames = buildAffiliateParamCandidates(input.platformParam, productParams);
  const affiliateRef = extractAffiliateRefFromWebhookPayload(
    input.body,
    paramNames,
    input.requestUrl,
  );
  const fromRef = await resolvePublisherFromAffiliateRef(affiliateRef);

  const fields = extractOrderFieldsFromClickFunnelsPayload(input.body);
  const lookup = await loadDigitalProductCommissionLookup();
  const resolved = lookup.resolve(fields.pageSlug, fields.amount);
  const at = input.at ?? new Date();
  const windowStart = new Date(at.getTime() - DIGITAL_PRODUCT_CLICK_ATTRIBUTION_WINDOW_MS);

  if (fromRef.publisherId) {
    if (!resolved.productId) {
      return {
        publisherId: fromRef.publisherId,
        affiliateRef: fromRef.affiliateRef,
        clickId: null,
        subId: null,
        src: null,
      };
    }

    const click = await prisma.digitalProductClick.findFirst({
      where: {
        productId: resolved.productId,
        publisherId: fromRef.publisherId,
        createdAt: { gte: windowStart, lte: at },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, subId: true, src: true },
    });

    return {
      publisherId: fromRef.publisherId,
      affiliateRef: fromRef.affiliateRef,
      clickId: click?.id ?? null,
      subId: click?.subId ?? null,
      src: click?.src ?? null,
    };
  }

  if (!resolved.productId) {
    return {
      publisherId: null,
      affiliateRef: fromRef.affiliateRef,
      clickId: null,
      subId: null,
      src: null,
    };
  }

  const click = await prisma.digitalProductClick.findFirst({
    where: {
      productId: resolved.productId,
      createdAt: { gte: windowStart, lte: at },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, publisherId: true, subId: true, src: true },
  });

  if (!click?.publisherId) {
    return {
      publisherId: null,
      affiliateRef: fromRef.affiliateRef,
      clickId: null,
      subId: null,
      src: null,
    };
  }

  return {
    publisherId: click.publisherId,
    affiliateRef: fromRef.affiliateRef ?? click.publisherId,
    clickId: click.id,
    subId: click.subId,
    src: click.src,
  };
}
