export type PromotionAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingUrl?: string;
};

export const PROMOTION_UTM_COOKIE_NAME = "lv_promo_utm";
export const PROMOTION_UTM_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const UTM_PARAM_MAP = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
} as const;

const MAX_UTM_LENGTH = 120;

/** Sanitize UTM values for storage and URLs. */
export function sanitizeUtmValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const safe = trimmed.replace(/[^\w.-]+/g, "_").slice(0, MAX_UTM_LENGTH);
  return safe || undefined;
}

export function readPromotionAttributionFromUrl(search?: string): PromotionAttribution {
  const params = new URLSearchParams(
    search ?? (typeof window !== "undefined" ? window.location.search : ""),
  );

  const attribution: PromotionAttribution = {};
  for (const [param, key] of Object.entries(UTM_PARAM_MAP)) {
    const value = sanitizeUtmValue(params.get(param));
    if (value) attribution[key] = value;
  }

  if (typeof window !== "undefined" && Object.keys(attribution).length > 0) {
    attribution.landingUrl = window.location.href;
  }

  return attribution;
}

function hasUtmData(data: PromotionAttribution): boolean {
  return Boolean(
    data.utmSource ||
      data.utmMedium ||
      data.utmCampaign ||
      data.utmContent ||
      data.utmTerm,
  );
}

export function readPromotionAttributionCookie(): PromotionAttribution {
  if (typeof document === "undefined") return {};
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${PROMOTION_UTM_COOKIE_NAME}=`));
  if (!match) return {};

  try {
    const raw = decodeURIComponent(match.split("=").slice(1).join("="));
    const parsed = JSON.parse(raw) as PromotionAttribution;
    return {
      utmSource: sanitizeUtmValue(parsed.utmSource),
      utmMedium: sanitizeUtmValue(parsed.utmMedium),
      utmCampaign: sanitizeUtmValue(parsed.utmCampaign),
      utmContent: sanitizeUtmValue(parsed.utmContent),
      utmTerm: sanitizeUtmValue(parsed.utmTerm),
      landingUrl: parsed.landingUrl?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

/** First-touch: set cookie when empty, or when URL includes utm_source. */
export function writePromotionAttributionCookie(data: PromotionAttribution) {
  if (typeof document === "undefined") return;
  if (!hasUtmData(data)) return;

  const existing = readPromotionAttributionCookie();
  if (hasUtmData(existing) && !data.utmSource) return;

  const payload: PromotionAttribution = {
    utmSource: data.utmSource ?? existing.utmSource,
    utmMedium: data.utmMedium ?? existing.utmMedium,
    utmCampaign: data.utmCampaign ?? existing.utmCampaign,
    utmContent: data.utmContent ?? existing.utmContent,
    utmTerm: data.utmTerm ?? existing.utmTerm,
    landingUrl: data.landingUrl ?? existing.landingUrl,
  };

  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PROMOTION_UTM_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; Path=/; Max-Age=${PROMOTION_UTM_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearPromotionAttributionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${PROMOTION_UTM_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function mergePromotionAttribution(
  fromUrl?: PromotionAttribution,
  fromCookie?: PromotionAttribution,
): PromotionAttribution {
  const url = fromUrl ?? {};
  const cookie = fromCookie ?? {};
  return {
    utmSource: url.utmSource ?? cookie.utmSource,
    utmMedium: url.utmMedium ?? cookie.utmMedium,
    utmCampaign: url.utmCampaign ?? cookie.utmCampaign,
    utmContent: url.utmContent ?? cookie.utmContent,
    utmTerm: url.utmTerm ?? cookie.utmTerm,
    landingUrl: url.landingUrl ?? cookie.landingUrl,
  };
}

export function buildPromotionUrl(
  origin: string,
  promotion: {
    landingPath: string;
    utmSource: string;
    utmMedium?: string | null;
    utmCampaign: string;
    utmContent?: string | null;
    utmTerm?: string | null;
  },
): string {
  const path = promotion.landingPath.startsWith("/")
    ? promotion.landingPath
    : `/${promotion.landingPath}`;
  const url = new URL(path, origin);
  url.searchParams.set("utm_source", promotion.utmSource);
  if (promotion.utmMedium) url.searchParams.set("utm_medium", promotion.utmMedium);
  url.searchParams.set("utm_campaign", promotion.utmCampaign);
  if (promotion.utmContent) url.searchParams.set("utm_content", promotion.utmContent);
  if (promotion.utmTerm) url.searchParams.set("utm_term", promotion.utmTerm);
  return url.toString();
}

export function normalizeAttributionForStorage(
  input: PromotionAttribution | null | undefined,
): PromotionAttribution | null {
  if (!input) return null;
  const normalized: PromotionAttribution = {
    utmSource: sanitizeUtmValue(input.utmSource),
    utmMedium: sanitizeUtmValue(input.utmMedium),
    utmCampaign: sanitizeUtmValue(input.utmCampaign),
    utmContent: sanitizeUtmValue(input.utmContent),
    utmTerm: sanitizeUtmValue(input.utmTerm),
    landingUrl: input.landingUrl?.trim().slice(0, 500) || undefined,
  };
  return hasUtmData(normalized) ? normalized : null;
}

export const FACEBOOK_PROMOTION_PRESET = {
  name: "Facebook Ads",
  utmSource: "facebook",
  utmMedium: "paid_social",
  utmCampaign: "fb_signup",
  landingPath: "/",
} as const;
