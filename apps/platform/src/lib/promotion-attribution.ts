export const PROMO_UTM_COOKIE_NAME = "promo_utm";
export const PROMO_VISIT_COOKIE_NAME = "promo_visit";
export const PROMO_UTM_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const PROMO_VISIT_DEDUPE_SECONDS = 60 * 30;

export type PromotionUtmFields = {
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string;
  utmContent: string | null;
  utmTerm: string | null;
};

export type PromotionAttributionPayload = PromotionUtmFields & {
  landingPath?: string | null;
  landingUrl?: string | null;
};

export type PromotionUrlInput = {
  landingPath: string;
  utmSource: string;
  utmMedium?: string | null;
  utmCampaign: string;
  utmContent?: string | null;
  utmTerm?: string | null;
};

export const FACEBOOK_PROMOTION_PRESET = {
  name: "Facebook Ads",
  utmSource: "facebook",
  utmMedium: "paid",
  utmCampaign: "{{campaign.name}}",
  utmContent: "{{ad.name}}",
  utmTerm: "{{adset.name}}",
  landingPath: "/",
} as const;

const UTM_MAX_LENGTH = 120;

function cleanUtmValue(value: string, preserveBraces: boolean): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const pattern = preserveBraces ? /[^a-zA-Z0-9_{}.-]/g : /[^a-zA-Z0-9_.-]/g;
  const cleaned = trimmed.replace(pattern, "_").slice(0, UTM_MAX_LENGTH);
  return cleaned;
}

export function sanitizeUtmValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = cleanUtmValue(value, false);
  return cleaned || null;
}

export function normalizeUtmTemplate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = cleanUtmValue(value, true);
  return cleaned || null;
}

export function encodeUtmQueryValue(value: string): string {
  return encodeURIComponent(value).replace(/%7B/g, "{").replace(/%7D/g, "}");
}

export function buildPromotionUrl(origin: string, promotion: PromotionUrlInput): string {
  const base = origin.replace(/\/$/, "");
  const path = promotion.landingPath.startsWith("/")
    ? promotion.landingPath
    : `/${promotion.landingPath}`;
  const url = new URL(`${base}${path}`);

  url.searchParams.set("utm_source", promotion.utmSource);
  url.searchParams.set("utm_campaign", promotion.utmCampaign);
  if (promotion.utmMedium) url.searchParams.set("utm_medium", promotion.utmMedium);
  if (promotion.utmContent) url.searchParams.set("utm_content", promotion.utmContent);
  if (promotion.utmTerm) url.searchParams.set("utm_term", promotion.utmTerm);

  const query = Array.from(url.searchParams.entries())
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeUtmQueryValue(val)}`)
    .join("&");

  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

export function buildPromotionClickUrl(origin: string, promotionId: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/v1/promo/click/${encodeURIComponent(promotionId)}`;
}

export function readPromotionAttributionFromUrl(search: string): Partial<PromotionAttributionPayload> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const utmSource = params.get("utm_source")?.trim() ?? "";
  const utmMedium = params.get("utm_medium")?.trim() ?? "";
  const utmCampaign = params.get("utm_campaign")?.trim() ?? "";

  if (!utmSource || !utmCampaign) {
    return {};
  }

  return {
    utmSource,
    utmMedium: utmMedium || null,
    utmCampaign,
    utmContent: params.get("utm_content")?.trim() || null,
    utmTerm: params.get("utm_term")?.trim() || null,
  };
}

export function hasCoreUtmFields(
  fields: Partial<PromotionUtmFields>,
): fields is PromotionUtmFields {
  return Boolean(fields.utmSource?.trim() && fields.utmCampaign?.trim());
}

export function utmKeyFromFields(fields: Partial<PromotionUtmFields>): string {
  return [
    fields.utmSource ?? "",
    fields.utmMedium ?? "",
    fields.utmCampaign ?? "",
    fields.utmContent ?? "",
    fields.utmTerm ?? "",
  ].join("|");
}

export function mergePromotionAttribution(
  urlFields: Partial<PromotionAttributionPayload>,
  cookieFields: Partial<PromotionAttributionPayload> | null,
): Partial<PromotionAttributionPayload> {
  const merged: Partial<PromotionAttributionPayload> = {
    ...(cookieFields ?? {}),
    ...Object.fromEntries(
      Object.entries(urlFields).filter(([, value]) => value != null && value !== ""),
    ),
  };

  if (!merged.utmSource || !merged.utmCampaign) {
    return cookieFields ?? {};
  }

  return merged;
}

export function buildVisitDedupeKey(fields: Partial<PromotionUtmFields>, promotionId?: string | null) {
  return promotionId ? `promo:${promotionId}` : `utm:${utmKeyFromFields(fields)}`;
}

export function readPromoUtmCookie(): Partial<PromotionAttributionPayload> | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${PROMO_UTM_COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.split("=").slice(1).join("="));
    return JSON.parse(raw) as Partial<PromotionAttributionPayload>;
  } catch {
    return null;
  }
}

export function writePromoUtmCookie(fields: Partial<PromotionAttributionPayload>) {
  if (typeof document === "undefined") return;
  if (!hasCoreUtmFields(fields)) return;

  const existing = readPromoUtmCookie();
  const shouldReplace =
    !existing?.utmSource ||
    (fields.utmSource && existing.utmSource !== fields.utmSource);

  const payload = shouldReplace ? fields : mergePromotionAttribution(fields, existing);
  if (!hasCoreUtmFields(payload)) return;

  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PROMO_UTM_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; Path=/; Max-Age=${PROMO_UTM_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearPromoUtmCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${PROMO_UTM_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readPromoVisitCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${PROMO_VISIT_COOKIE_NAME}=`));
  if (!match) return "";
  try {
    return decodeURIComponent(match.split("=").slice(1).join("=")).trim();
  } catch {
    return "";
  }
}

export function writePromoVisitCookie(dedupeKey: string) {
  if (typeof document === "undefined") return;
  const key = dedupeKey.trim();
  if (!key) return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PROMO_VISIT_COOKIE_NAME}=${encodeURIComponent(key)}; Path=/; Max-Age=${PROMO_VISIT_DEDUPE_SECONDS}; SameSite=Lax${secure}`;
}

export function normalizeAttributionForStorage(
  input: Partial<PromotionAttributionPayload>,
): PromotionAttributionPayload | null {
  const utmSource = sanitizeUtmValue(input.utmSource);
  const utmCampaign = sanitizeUtmValue(input.utmCampaign);
  if (!utmSource || !utmCampaign) return null;

  return {
    utmSource,
    utmMedium: sanitizeUtmValue(input.utmMedium),
    utmCampaign,
    utmContent: sanitizeUtmValue(input.utmContent),
    utmTerm: sanitizeUtmValue(input.utmTerm),
    landingPath: input.landingPath?.trim() || null,
    landingUrl: input.landingUrl?.trim() || null,
  };
}

export function calculateSignupRate(signups: number, visits: number): number | null {
  if (visits <= 0) return null;
  return Math.round((signups / visits) * 1000) / 10;
}
