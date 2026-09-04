import {
  buildDigitalProductDestinationUrl,
  DEFAULT_DIGITAL_PRODUCT_AFFILIATE_PARAM,
  type DigitalProductAffiliateUrlExtras,
} from "@cpl/shared";

/** @deprecated Prefer DEFAULT_DIGITAL_PRODUCT_AFFILIATE_PARAM from @cpl/shared */
export const DEFAULT_AFFILIATE_TRACKING_PARAM = DEFAULT_DIGITAL_PRODUCT_AFFILIATE_PARAM;

export type { DigitalProductAffiliateUrlExtras };

/**
 * Build a publisher-specific tracked sales URL for a digital product
 * (final destination after tracking redirect).
 */
export function buildDigitalProductAffiliateUrl(
  salesPageUrl: string | null | undefined,
  trackingParam: string | null | undefined,
  publisherId: string,
  extras?: DigitalProductAffiliateUrlExtras,
): string | null {
  return buildDigitalProductDestinationUrl(
    salesPageUrl,
    trackingParam,
    publisherId,
    extras,
  );
}
