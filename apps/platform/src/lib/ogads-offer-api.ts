export type OgadsOfferDto = {
  id: string;
  name: string;
  payout: string;
  type: string | null;
  country: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  trackingUrl: string;
};

type CacheEntry = {
  expiresAt: number;
  offers: OgadsOfferDto[];
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function extractOfferList(body: unknown): unknown[] {
  const payload = asRecord(body);
  const nested = payload ? asRecord(payload.data) : null;
  const candidates = [
    payload?.offers,
    payload?.ads,
    payload?.data,
    nested?.offers,
    nested?.ads,
    body,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    const rec = asRecord(candidate);
    if (rec) {
      const values = Object.values(rec);
      if (values.length > 0 && values.every((v) => v && typeof v === "object")) {
        return values;
      }
    }
  }
  return [];
}

function normalizeOffer(raw: unknown): OgadsOfferDto | null {
  const row = asRecord(raw);
  if (!row) return null;

  const id = pickString(row.id, row.offer_id, row.offerid, row.offerId);
  const trackingUrl =
    pickString(
      row.link,
      row.url,
      row.tracking_url,
      row.trackingUrl,
      row.offer_url,
      row.offerurl,
      row.click_url,
      row.clickurl,
      row.href,
      row.destination,
    ) ?? "";
  const name = pickString(row.name, row.title, row.offer_name) ?? "Offer";
  if (!id) return null;

  const payoutRaw = pickString(row.payout, row.amount, row.epc, row.rate) ?? "0";
  const payoutNum = Number(payoutRaw);
  const payout = Number.isFinite(payoutNum) ? payoutNum.toFixed(2) : payoutRaw;

  return {
    id,
    name,
    payout,
    type: pickString(row.type, row.offer_type, row.conversion_type, row.ctype),
    country: pickString(row.country, row.countries, row.geo),
    thumbnailUrl: pickString(
      row.thumbnail,
      row.picture,
      row.image,
      row.image_url,
      row.icon,
      row.creatives,
    ),
    description: pickString(row.description, row.desc, row.adcopy, row.requirements),
    trackingUrl,
  };
}

export async function fetchOgadsOffers(input: {
  endpoint: string;
  apiKey: string;
  ip: string;
  userAgent: string;
  affSub4?: string;
  max?: number;
}): Promise<{ offers: OgadsOfferDto[]; error?: string }> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    return { offers: [], error: "OGAds Offer API key is not configured." };
  }

  const affSub4 = input.affSub4?.trim() ?? "";
  const cacheKey = `${affSub4}|${input.ip}|${input.userAgent}|${input.max ?? 50}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { offers: cached.offers };
  }

  const endpoint = input.endpoint.trim().replace(/\/$/, "") || "https://lockerpreview.com/api/v2";
  const url = new URL(endpoint);
  url.searchParams.set("ip", input.ip || "0.0.0.0");
  url.searchParams.set("user_agent", input.userAgent || "Mozilla/5.0");
  if (affSub4) url.searchParams.set("aff_sub4", affSub4);
  const max = input.max && input.max > 0 ? Math.min(200, Math.floor(input.max)) : 100;
  url.searchParams.set("max", String(max));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch (error) {
    return {
      offers: [],
      error: error instanceof Error ? error.message : "Failed to reach OGAds Offer API",
    };
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (body && typeof body === "object" && typeof (body as { error?: string }).error === "string"
        ? (body as { error: string }).error
        : null) || `OGAds API returned HTTP ${response.status}`;
    return { offers: [], error: message };
  }

  const payload = asRecord(body);
  if (payload && payload.success === false) {
    return {
      offers: [],
      error: pickString(payload.error, payload.message) ?? "OGAds API returned an error",
    };
  }

  const offers = extractOfferList(body)
    .map(normalizeOffer)
    .filter((offer): offer is OgadsOfferDto => Boolean(offer));

  cache.set(cacheKey, { offers, expiresAt: Date.now() + CACHE_TTL_MS });
  return { offers };
}
