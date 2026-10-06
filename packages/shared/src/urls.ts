import { getPlatformUrl, getTrackingUrl } from "./env";
import { buildTrackingUrl, sanitizeTrackingParam } from "./smart-link";

/** Default ClickFunnels / platform tracking query param for digital products. */
export const DEFAULT_DIGITAL_PRODUCT_AFFILIATE_PARAM = "affsense_id";

/** Sales page query param carrying the DigitalProductClick id back via the CF webhook. */
export const DIGITAL_PRODUCT_CLICK_PARAM = "aff_click";

export type DigitalProductAffiliateUrlExtras = {
  source?: string;
  subid?: string;
  subid2?: string;
  subid3?: string;
  subid4?: string;
  campaign?: string;
  clickId?: string;
};

export type TrackingSubIds = {
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  sub4: string | null;
};

/** Read `sub1`..`sub4` from a tracking link; legacy `sub_id` is an alias for `sub1`. */
export function readSubIds(searchParams: URLSearchParams): TrackingSubIds {
  const read = (key: string) => searchParams.get(key)?.trim() || null;
  return {
    sub1: read("sub1") ?? read("sub_id"),
    sub2: read("sub2"),
    sub3: read("sub3"),
    sub4: read("sub4"),
  };
}

/** Optional Sub ID 2-4 on publisher share links (Sub ID 1 is written as `sub_id`). */
export type ExtraSubIdParams = {
  subId2?: string;
  subId3?: string;
  subId4?: string;
};

function setExtraSubIds(url: URL, params?: ExtraSubIdParams) {
  if (params?.subId2) url.searchParams.set("sub2", params.subId2);
  if (params?.subId3) url.searchParams.set("sub3", params.subId3);
  if (params?.subId4) url.searchParams.set("sub4", params.subId4);
}

export type DigitalProductTrackingParams = ExtraSubIdParams & {
  publisherId?: string;
  src?: string;
  subId?: string;
  campaign?: string;
  /** Additional front-end sales page id; omit for the main sales page. */
  pageId?: string;
};

/**
 * Append affiliate tracking param (+ optional source/subid/campaign) to a sales page URL.
 * Used as the final redirect destination after /dp/{productId}.
 */
export function buildDigitalProductDestinationUrl(
  salesPageUrl: string | null | undefined,
  trackingParam: string | null | undefined,
  publisherId: string,
  extras?: DigitalProductAffiliateUrlExtras,
): string | null {
  if (!salesPageUrl?.trim() || !publisherId.trim()) return null;
  const key = trackingParam?.trim() || DEFAULT_DIGITAL_PRODUCT_AFFILIATE_PARAM;
  const base = salesPageUrl.trim();

  let withAffiliate: string;
  try {
    const url = new URL(base);
    url.searchParams.set(key, publisherId);
    withAffiliate = url.toString();
  } catch {
    const hashIndex = base.indexOf("#");
    const beforeHash = hashIndex >= 0 ? base.slice(0, hashIndex) : base;
    const hash = hashIndex >= 0 ? base.slice(hashIndex) : "";
    const joiner = beforeHash.includes("?") ? "&" : "?";
    withAffiliate = `${beforeHash}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(publisherId)}${hash}`;
  }

  if (!extras) return withAffiliate;
  const raw: Array<[string, string | undefined]> = [
    ["source", extras.source],
    ["subid", extras.subid],
    ["subid2", extras.subid2],
    ["subid3", extras.subid3],
    ["subid4", extras.subid4],
    ["campaign", extras.campaign],
    [DIGITAL_PRODUCT_CLICK_PARAM, extras.clickId],
  ];
  const entries: Array<[string, string]> = [];
  for (const [key, value] of raw) {
    const clean = sanitizeTrackingParam(value);
    if (clean) entries.push([key, clean]);
  }
  if (entries.length === 0) return withAffiliate;

  try {
    const parsed = new URL(withAffiliate);
    for (const [key, value] of entries) parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    const parts = entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
    const hashIndex = withAffiliate.indexOf("#");
    const beforeHash = hashIndex >= 0 ? withAffiliate.slice(0, hashIndex) : withAffiliate;
    const hash = hashIndex >= 0 ? withAffiliate.slice(hashIndex) : "";
    const joiner = beforeHash.includes("?") ? "&" : "?";
    return `${beforeHash}${joiner}${parts.join("&")}${hash}`;
  }
}

/** Publisher share link on the tracking domain; redirects to the sales page. */
export function buildDigitalProductTrackingUrl(
  productId: string,
  params?: DigitalProductTrackingParams,
  trackingBaseUrl?: string,
) {
  const url = new URL(
    `${trackingBaseUrl ?? getTrackingUrl()}/dp/${encodeURIComponent(productId)}`,
  );
  if (params?.publisherId) url.searchParams.set("pub_id", params.publisherId);
  if (params?.src) url.searchParams.set("src", params.src);
  if (params?.subId) url.searchParams.set("sub_id", params.subId);
  setExtraSubIds(url, params);
  if (params?.campaign) url.searchParams.set("campaign", params.campaign);
  if (params?.pageId) url.searchParams.set("page", params.pageId);
  return url.toString();
}

export function buildSmartLinkUrl(
  slug: string,
  params?: { src?: string; subId?: string },
  trackingBaseUrl?: string,
) {
  const base = `${trackingBaseUrl ?? getTrackingUrl()}/s/${slug}`;
  return params ? buildTrackingUrl(base, params) : base;
}

export function buildTrackingFormUrl(
  slug: string,
  params?: { src?: string; subId?: string },
  trackingBaseUrl?: string,
) {
  const base = `${trackingBaseUrl ?? getTrackingUrl()}/t/${slug}`;
  return params ? buildTrackingUrl(base, params) : base;
}

/** Public advertiser optin funnel landing page (platform). */
export function buildOptinPageUrl(
  optinSlug: string,
  params?: { src?: string; subId?: string; trackingSlug?: string },
  platformBaseUrl?: string,
) {
  const url = new URL(`${platformBaseUrl ?? getPlatformUrl()}/o/${optinSlug}`);
  if (params?.src) url.searchParams.set("src", params.src);
  if (params?.subId) url.searchParams.set("sub_id", params.subId);
  if (params?.trackingSlug) url.searchParams.set("tracking_slug", params.trackingSlug);
  return url.toString();
}

/** Prefer campaign targeting.destinationUrl / optinSlug; otherwise null (caller uses /t/). */
export function resolveCampaignLandingUrl(
  targeting: unknown,
  params?: { src?: string; subId?: string; trackingSlug?: string },
  platformBaseUrl?: string,
): string | null {
  if (!targeting || typeof targeting !== "object") return null;
  const t = targeting as Record<string, unknown>;
  const destinationUrl =
    typeof t.destinationUrl === "string" ? t.destinationUrl.trim() : "";
  const optinSlug = typeof t.optinSlug === "string" ? t.optinSlug.trim() : "";

  let base: string | null = null;
  if (destinationUrl) {
    base = destinationUrl;
  } else if (optinSlug) {
    base = `${platformBaseUrl ?? getPlatformUrl()}/o/${optinSlug}`;
  }
  if (!base) return null;

  try {
    const url = base.startsWith("/")
      ? new URL(base, platformBaseUrl ?? getPlatformUrl())
      : new URL(base);
    if (params?.src) url.searchParams.set("src", params.src);
    if (params?.subId) url.searchParams.set("sub_id", params.subId);
    if (params?.trackingSlug) url.searchParams.set("tracking_slug", params.trackingSlug);
    return url.toString();
  } catch {
    return null;
  }
}

export function buildPixelUrl(pixelToken: string, trackingBaseUrl?: string) {
  const base = `${trackingBaseUrl ?? getTrackingUrl()}/api/v1/pixel/${pixelToken}`;
  return `${base}?lead_id={lead_id}&txn_id={txn_id}`;
}

/**
 * Network-wide CPA inbound postback URL (Affsense/Tesaleme style).
 * Offer + advertiser are resolved from click_id — no per-offer token.
 */
export function buildGlobalCpaPostbackUrl(trackingBaseUrl?: string) {
  return `${trackingBaseUrl ?? getTrackingUrl()}/pbtr?click_id={click_id}&payout={payout}`;
}

/**
 * @deprecated Prefer buildGlobalCpaPostbackUrl. Kept for legacy /pbtr/{token} links.
 */
export function buildCpaOfferPostbackUrl(
  postbackToken: string,
  trackingBaseUrl?: string,
) {
  return `${trackingBaseUrl ?? getTrackingUrl()}/pbtr/${encodeURIComponent(postbackToken)}?click_id={click_id}&payout={payout}`;
}

export type CpaOfferTrackingParams = ExtraSubIdParams & {
  advertiserId?: string;
  publisherId?: string;
  src?: string;
  subId?: string;
  leadId?: string;
};

/** Platform redirect link advertisers/publishers use to send traffic into a CPA offer. */
export function buildCpaOfferTrackingUrl(
  offerId: string,
  params?: CpaOfferTrackingParams,
  trackingBaseUrl?: string,
) {
  const url = new URL(`${trackingBaseUrl ?? getTrackingUrl()}/cpa/${encodeURIComponent(offerId)}`);
  if (params?.advertiserId) url.searchParams.set("adv_id", params.advertiserId);
  if (params?.publisherId) url.searchParams.set("pub_id", params.publisherId);
  if (params?.src) url.searchParams.set("src", params.src);
  if (params?.subId) url.searchParams.set("sub_id", params.subId);
  setExtraSubIds(url, params);
  if (params?.leadId) url.searchParams.set("lead_id", params.leadId);
  return url.toString();
}

/** Resolve a CPA offer id to the platform tracking redirect URL. */
export function resolveCpaOfferRedirectUrl(
  offerId: string,
  params?: CpaOfferTrackingParams,
  trackingBaseUrl?: string,
) {
  return buildCpaOfferTrackingUrl(offerId, params, trackingBaseUrl);
}

export function buildPixelSnippet(pixelUrl: string) {
  return `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
}

export function buildTrackingScriptUrl() {
  return `${getTrackingUrl()}/track.js`;
}

export function buildPlatformLeadSubmitUrl() {
  return `${getPlatformUrl()}/api/internal/v1/leads/submit`;
}

export function buildPlatformCpaSaleNotifyUrl() {
  return `${getPlatformUrl()}/api/internal/v1/cpa-sale-notify`;
}

export { getPlatformUrl, getTrackingUrl };
