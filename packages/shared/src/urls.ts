import { getPlatformUrl, getTrackingUrl } from "./env";
import { buildTrackingUrl } from "./smart-link";

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

export type CpaOfferTrackingParams = {
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
