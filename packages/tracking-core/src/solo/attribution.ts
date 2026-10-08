/** How a ClickFunnels sale was matched to an affiliate. */
export type WebhookAttributionMethod =
  | "exact_click"
  | "sub_match"
  | "recent_click"
  | "affiliate_ref"
  | "subscription"
  | "lifetime_email";

/**
 * Only these prove the buyer came through one specific click. Sub-id matches,
 * "latest click" fallbacks and email matches never count for Solo Ads.
 */
export function isSoloProofAttribution(method: string | null | undefined): boolean {
  return method === "exact_click" || method === "subscription";
}

export function isWithinAttributionWindow(clickAt: Date, at: Date, windowDays: number): boolean {
  const age = at.getTime() - clickAt.getTime();
  return age >= 0 && age <= windowDays * 24 * 60 * 60 * 1000;
}

export type SoloClickForLink = {
  campaignId: string | null;
  publisherId: string | null;
  offerType: "CPA" | "DIGITAL" | null;
  cpaOfferId: string | null;
  digitalProductId: string | null;
  billingStatus: string;
  createdAt: Date;
};

export type SoloLinkRejection =
  | "not_found"
  | "no_campaign"
  | "invalid_click"
  | "wrong_affiliate"
  | "wrong_offer"
  | "expired";

/**
 * May a visitor carrying `affs_click_id` be linked to this affiliate's offer
 * click? The browser-supplied id is only a lookup key; every field must match.
 */
export function checkSoloClickLink(input: {
  click: SoloClickForLink | null;
  publisherId: string;
  offerType: "CPA" | "DIGITAL";
  offerId: string;
  at: Date;
  windowDays: number;
}): { ok: true } | { ok: false; reason: SoloLinkRejection } {
  const { click } = input;
  if (!click) return { ok: false, reason: "not_found" };
  if (!click.campaignId) return { ok: false, reason: "no_campaign" };
  if (click.billingStatus === "INVALID" || click.billingStatus === "FALLBACK") {
    return { ok: false, reason: "invalid_click" };
  }
  if (click.publisherId !== input.publisherId) return { ok: false, reason: "wrong_affiliate" };
  const offerMatches =
    click.offerType === input.offerType &&
    (input.offerType === "CPA" ? click.cpaOfferId === input.offerId : click.digitalProductId === input.offerId);
  if (!offerMatches) return { ok: false, reason: "wrong_offer" };
  if (!isWithinAttributionWindow(click.createdAt, input.at, input.windowDays)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export function dollarsToCents(amount: number | string | { toString(): string } | null | undefined): number {
  if (amount == null) return 0;
  const n = Number(typeof amount === "object" ? amount.toString() : amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
