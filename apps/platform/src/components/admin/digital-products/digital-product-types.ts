// Types, constants, and pure utilities for digital products.
// No mock data, no localStorage.

export type DigitalProductStatus = "Active" | "Draft";

export type ProductCategoryItem = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  productCount: number;
};

export interface DigitalProductListItem {
  id: string;
  name: string;
  category: string;
  niche: string;
  productType: string;
  status: DigitalProductStatus;
  price: number;
  frontEndCommission: number;
  featured: boolean;
  isNew: boolean;
  thumbTone: string;
  vendor: string;
  imageUrl?: string;
}

export interface DigitalProductUpsellFormValues {
  name: string;
  pageUrl: string;
  price: string;
  commissionPct: string;
}

export interface DigitalProductFormValues {
  name: string;
  category: string;
  shortDescription: string;
  productType: string;
  niche: string;
  status: DigitalProductStatus;
  featured: boolean;
  isNew: boolean;
  salesPageUrl: string;
  affiliateTrackingParam: string;
  previewUrl: string;
  frontEndCommission: string;
  referralReward: string;
  price: string;
  vendor: string;
  webhookSecret: string;
  upsells: DigitalProductUpsellFormValues[];
}

export const DIGITAL_PRODUCT_TYPES = [
  "Digital Download",
  "Membership",
  "Course",
  "Software License",
] as const;

export const DIGITAL_PRODUCT_NICHES = [
  "Productivity",
  "Business",
  "Health & Wellness",
  "Personal Finance",
  "Technology",
] as const;

export const SHORT_DESCRIPTION_MAX = 160;

export const DEFAULT_FORM_VALUES: DigitalProductFormValues = {
  name: "",
  category: "",
  shortDescription: "",
  productType: "Digital Download",
  niche: "Productivity",
  status: "Draft",
  featured: false,
  isNew: false,
  salesPageUrl: "",
  affiliateTrackingParam: "affsense_id",
  previewUrl: "",
  frontEndCommission: "50",
  referralReward: "",
  price: "",
  vendor: "",
  webhookSecret: "",
  upsells: [],
};

export function emptyUpsellFormValues(): DigitalProductUpsellFormValues {
  return {
    name: "",
    pageUrl: "",
    price: "",
    commissionPct: "50",
  };
}

/**
 * Derive a ClickFunnels-style page_slug from a full page URL
 * (last non-empty path segment, lowercased).
 */
export function derivePageSlugFromUrl(urlLike: string): string | null {
  const raw = urlLike.trim();
  if (!raw) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    return decodeURIComponent(last).trim().toLowerCase() || null;
  } catch {
    const withoutQuery = raw.split(/[?#]/)[0] ?? raw;
    const segments = withoutQuery.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    try {
      return decodeURIComponent(last).trim().toLowerCase() || null;
    } catch {
      return last.trim().toLowerCase() || null;
    }
  }
}

export function computeCommissionAmount(price: number, percent: number): string {
  const amount = (price * percent) / 100;
  return `$${amount.toFixed(2)}`;
}

/** Sample affiliate id shown in admin URL previews (not a real publisher id). */
export const AFFILIATE_TRACKING_SAMPLE_VALUE = "AFFILIATE_ID";

/**
 * Compose sales page URL with tracking query param for admin preview.
 * Handles existing query strings and hash fragments.
 */
export function buildAffiliateTrackingPreviewUrl(
  salesPageUrl: string,
  trackingParam: string,
  sampleValue: string = AFFILIATE_TRACKING_SAMPLE_VALUE,
): string | null {
  const base = salesPageUrl.trim();
  const key = trackingParam.trim() || "affsense_id";
  if (!base) return null;

  try {
    const url = new URL(base);
    url.searchParams.set(key, sampleValue);
    return url.toString();
  } catch {
    // Relative or incomplete URL — do a best-effort string append.
    const hashIndex = base.indexOf("#");
    const beforeHash = hashIndex >= 0 ? base.slice(0, hashIndex) : base;
    const hash = hashIndex >= 0 ? base.slice(hashIndex) : "";
    const joiner = beforeHash.includes("?") ? "&" : "?";
    return `${beforeHash}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(sampleValue)}${hash}`;
  }
}

export function filterDigitalProducts(
  products: DigitalProductListItem[],
  filters: { q?: string; status?: string; category?: string; type?: string },
): DigitalProductListItem[] {
  let result = products;

  if (filters.status) {
    result = result.filter((p) => p.status === filters.status);
  }
  if (filters.category) {
    result = result.filter(
      (p) => p.category.toLowerCase() === filters.category!.toLowerCase(),
    );
  }
  if (filters.type) {
    result = result.filter(
      (p) => p.productType.toLowerCase() === filters.type!.toLowerCase(),
    );
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }

  return result;
}
