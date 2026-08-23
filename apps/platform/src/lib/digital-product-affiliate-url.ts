import { buildAffiliateTrackingPreviewUrl } from "@/components/admin/digital-products/digital-product-types";

/** Default ClickFunnels / platform tracking query param. */
export const DEFAULT_AFFILIATE_TRACKING_PARAM = "affsense_id";

/**
 * Build a publisher-specific tracked sales URL for a digital product.
 */
export function buildDigitalProductAffiliateUrl(
  salesPageUrl: string | null | undefined,
  trackingParam: string | null | undefined,
  publisherId: string,
): string | null {
  if (!salesPageUrl?.trim() || !publisherId.trim()) return null;
  return buildAffiliateTrackingPreviewUrl(
    salesPageUrl,
    trackingParam?.trim() || DEFAULT_AFFILIATE_TRACKING_PARAM,
    publisherId,
  );
}
