import { DIGITAL_PRODUCT_CLICK_PARAM, sanitizeTrackingParam } from "@cpl/shared";
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
  return extractParamFromWebhookPayload(body, paramNames, requestUrl);
}

/** Exact param lookup (no affiliate aliases added) across request query, payload fields, and visit URLs. */
export function extractParamFromWebhookPayload(
  body: unknown,
  paramNames: string[],
  requestUrl?: URL,
): string | null {
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

export type LandingTrackingParams = {
  clickId: string | null;
  subId: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  source: string | null;
};

/**
 * Tracking params our /dp redirect appended to the sales page (aff_click, subid, source).
 * Read from the visit URL that carries the affiliate param so all values belong to one visit.
 */
export function extractLandingTrackingParams(
  body: unknown,
  affiliateParamNames: string[],
): LandingTrackingParams {
  const urls = collectClickFunnelsUrlCandidates(body);
  const hasAffiliate = (url: string) =>
    affiliateParamNames.some((key) => Boolean(extractParamFromUrl(url, key)));
  const visitUrl =
    urls.find((url) => hasAffiliate(url) && extractParamFromUrl(url, DIGITAL_PRODUCT_CLICK_PARAM)) ??
    urls.find(hasAffiliate) ??
    urls.find((url) => extractParamFromUrl(url, DIGITAL_PRODUCT_CLICK_PARAM));
  if (!visitUrl) return { clickId: null, subId: null, subId2: null, subId3: null, subId4: null, source: null };

  const read = (key: string) => sanitizeTrackingParam(extractParamFromUrl(visitUrl, key)) || null;
  return {
    clickId: read(DIGITAL_PRODUCT_CLICK_PARAM),
    subId: read("subid") ?? read("sub_id") ?? read("sub1"),
    subId2: read("subid2") ?? read("sub2"),
    subId3: read("subid3") ?? read("sub3"),
    subId4: read("subid4") ?? read("sub4"),
    source: read("source") ?? read("src"),
  };
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
 * Resolve publisher from the affiliate tracking param in the webhook payload.
 * Sales without the param are NOT attributed — a recent click by some publisher is
 * never enough (organic sales and renewals would be credited to the latest clicker).
 * clickId / subId / src come from that publisher's own click on the same product.
 */
export type DigitalProductWebhookAttribution = {
  publisherId: string | null;
  affiliateRef: string | null;
  clickId: string | null;
  subId: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  src: string | null;
};

export async function resolveDigitalProductWebhookAttribution(input: {
  body: unknown;
  platformParam?: string | null;
  requestUrl?: URL;
  at?: Date;
  /** Product resolved from the CF product mapping; omit to fall back to the catalog lookup. */
  productId?: string | null;
}): Promise<DigitalProductWebhookAttribution> {
  const productParams = await loadDigitalProductAffiliateParamNames();
  const paramNames = buildAffiliateParamCandidates(input.platformParam, productParams);
  const affiliateRef = extractAffiliateRefFromWebhookPayload(
    input.body,
    paramNames,
    input.requestUrl,
  );
  const fromRef = await resolvePublisherFromAffiliateRef(affiliateRef);

  if (!fromRef.publisherId) {
    return {
      publisherId: null,
      affiliateRef: fromRef.affiliateRef,
      clickId: null,
      subId: null,
      subId2: null,
      subId3: null,
      subId4: null,
      src: null,
    };
  }

  let productId = input.productId;
  if (productId === undefined) {
    const fields = extractOrderFieldsFromClickFunnelsPayload(input.body);
    const lookup = await loadDigitalProductCommissionLookup();
    productId = lookup.resolve(fields.pageSlug, fields.amount).productId;
  }

  const base = { publisherId: fromRef.publisherId, affiliateRef: fromRef.affiliateRef };
  const landing = extractLandingTrackingParams(input.body, paramNames);

  // 1. Exact click our /dp redirect passed to the sales page.
  if (landing.clickId) {
    const exact = await prisma.digitalProductClick.findFirst({
      where: {
        id: landing.clickId,
        publisherId: fromRef.publisherId,
        ...(productId ? { productId } : {}),
      },
      select: { id: true, subId: true, subId2: true, subId3: true, subId4: true, src: true },
    });
    if (exact) {
      return {
        ...base,
        clickId: exact.id,
        subId: exact.subId,
        subId2: exact.subId2,
        subId3: exact.subId3,
        subId4: exact.subId4,
        src: exact.src,
      };
    }
  }

  const landingTracking = {
    subId: landing.subId,
    subId2: landing.subId2,
    subId3: landing.subId3,
    subId4: landing.subId4,
    src: landing.source,
  };
  const hasLandingParams = Boolean(
    landing.subId || landing.subId2 || landing.subId3 || landing.subId4 || landing.source,
  );
  if (!productId) {
    return { ...base, clickId: null, ...landingTracking };
  }

  const at = input.at ?? new Date();
  const windowStart = new Date(at.getTime() - DIGITAL_PRODUCT_CLICK_ATTRIBUTION_WINDOW_MS);

  // 2. subid/source from the buyer's visit URL; 3. otherwise the latest click in window.
  const click = await prisma.digitalProductClick.findFirst({
    where: {
      productId,
      publisherId: fromRef.publisherId,
      createdAt: { gte: windowStart, lte: at },
      ...(landing.subId ? { subId: landing.subId } : {}),
      ...(landing.subId2 ? { subId2: landing.subId2 } : {}),
      ...(landing.subId3 ? { subId3: landing.subId3 } : {}),
      ...(landing.subId4 ? { subId4: landing.subId4 } : {}),
      ...(landing.source ? { src: landing.source } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, subId: true, subId2: true, subId3: true, subId4: true, src: true },
  });

  if (hasLandingParams) {
    return { ...base, clickId: click?.id ?? null, ...landingTracking };
  }

  return {
    ...base,
    clickId: click?.id ?? null,
    subId: click?.subId ?? null,
    subId2: click?.subId2 ?? null,
    subId3: click?.subId3 ?? null,
    subId4: click?.subId4 ?? null,
    src: click?.src ?? null,
  };
}
