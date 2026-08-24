import { buildAffiliateTrackingPreviewUrl } from "@/components/admin/digital-products/digital-product-types";
import { sanitizeTrackingParam } from "@cpl/shared";

/** Default ClickFunnels / platform tracking query param. */
export const DEFAULT_AFFILIATE_TRACKING_PARAM = "affsense_id";

export type DigitalProductAffiliateUrlExtras = {
  source?: string;
  subid?: string;
  campaign?: string;
};

function appendTrackingExtras(
  url: string,
  extras?: DigitalProductAffiliateUrlExtras,
): string {
  if (!extras) return url;
  const source = sanitizeTrackingParam(extras.source);
  const subid = sanitizeTrackingParam(extras.subid);
  const campaign = sanitizeTrackingParam(extras.campaign);
  if (!source && !subid && !campaign) return url;

  try {
    const parsed = new URL(url);
    if (source) parsed.searchParams.set("source", source);
    if (subid) parsed.searchParams.set("subid", subid);
    if (campaign) parsed.searchParams.set("campaign", campaign);
    return parsed.toString();
  } catch {
    const parts: string[] = [];
    if (source) parts.push(`source=${encodeURIComponent(source)}`);
    if (subid) parts.push(`subid=${encodeURIComponent(subid)}`);
    if (campaign) parts.push(`campaign=${encodeURIComponent(campaign)}`);
    const hashIndex = url.indexOf("#");
    const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
    const joiner = beforeHash.includes("?") ? "&" : "?";
    return `${beforeHash}${joiner}${parts.join("&")}${hash}`;
  }
}

/**
 * Build a publisher-specific tracked sales URL for a digital product.
 */
export function buildDigitalProductAffiliateUrl(
  salesPageUrl: string | null | undefined,
  trackingParam: string | null | undefined,
  publisherId: string,
  extras?: DigitalProductAffiliateUrlExtras,
): string | null {
  if (!salesPageUrl?.trim() || !publisherId.trim()) return null;
  const base = buildAffiliateTrackingPreviewUrl(
    salesPageUrl,
    trackingParam?.trim() || DEFAULT_AFFILIATE_TRACKING_PARAM,
    publisherId,
  );
  if (!base) return null;
  return appendTrackingExtras(base, extras);
}
