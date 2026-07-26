import type { Campaign } from "@prisma/client";

export type CampaignTargetingGeo = {
  trafficMode?: "allow" | "block";
  countries?: string[];
  blacklistedCountries?: string[];
};

export function parseCampaignTargeting(targeting: unknown): CampaignTargetingGeo {
  if (!targeting || typeof targeting !== "object") return {};
  const t = targeting as Record<string, unknown>;
  return {
    trafficMode: t.trafficMode === "block" ? "block" : "allow",
    countries: Array.isArray(t.countries)
      ? t.countries.map((c) => String(c).toUpperCase())
      : [],
    blacklistedCountries: Array.isArray(t.blacklistedCountries)
      ? t.blacklistedCountries.map((c) => String(c).toUpperCase())
      : [],
  };
}

/** Whether a campaign accepts traffic from the visitor's country (if known). */
export function campaignAcceptsCountry(targeting: unknown, countryCode?: string): boolean {
  const parsed = parseCampaignTargeting(targeting);
  const countries = parsed.countries ?? [];
  const blacklistedCountries = parsed.blacklistedCountries ?? [];
  const country = countryCode?.trim().toUpperCase();

  if (!country) {
    // Unknown geo (missing IP lookup / private IP): do not drop country-targeted
    // campaigns, or smart links fall through to the global fallback URL.
    return true;
  }

  // Legacy block-only campaigns (empty allow list): keep previous blacklist behavior.
  if (countries.length === 0) {
    if ((parsed.trafficMode ?? "allow") === "block") {
      return !blacklistedCountries.includes(country);
    }
    return true;
  }

  if (!countries.includes(country)) return false;
  if (blacklistedCountries.includes(country)) return false;
  return true;
}

export function filterCampaignsByCountry<T extends Pick<Campaign, "targeting">>(
  campaigns: T[],
  countryCode?: string,
): T[] {
  return campaigns.filter((c) => campaignAcceptsCountry(c.targeting, countryCode));
}

type RotatableCampaign = Pick<Campaign, "id" | "advertiserId">;

/**
 * Pick the next campaign for a returning visitor.
 * Prefer unseen campaigns (different advertiser first), then seen campaigns with
 * a different advertiser, then a different campaign id. Returns null when the
 * only option would be the same campaign again.
 */
export function pickCampaignForIpRotation<T extends RotatableCampaign>(
  eligible: T[],
  shownCampaignIds: string[],
  rotationCursor: number,
): T | null {
  if (eligible.length === 0) return null;

  const lastShownId = shownCampaignIds[0];
  const lastAdvertiserId = eligible.find((c) => c.id === lastShownId)?.advertiserId;
  const shownSet = new Set(shownCampaignIds);

  const pickFromPool = (pool: T[]): T | null => {
    if (pool.length === 0) return null;
    const index = rotationCursor % pool.length;
    return pool[index] ?? null;
  };

  const preferDifferentAdvertiser = (pool: T[]) => {
    if (!lastAdvertiserId) return pool;
    const different = pool.filter((c) => c.advertiserId !== lastAdvertiserId);
    return different.length > 0 ? different : pool;
  };

  // 1–2: unseen campaigns (prefer different advertiser)
  const unseen = eligible.filter((c) => !shownSet.has(c.id));
  const unseenPick = pickFromPool(preferDifferentAdvertiser(unseen));
  if (unseenPick) return unseenPick;

  // 3: already seen, different advertiser
  if (lastAdvertiserId) {
    const seenDifferentAdvertiser = eligible.filter(
      (c) => shownSet.has(c.id) && c.advertiserId !== lastAdvertiserId,
    );
    const seenAdvPick = pickFromPool(seenDifferentAdvertiser);
    if (seenAdvPick) return seenAdvPick;
  }

  // 4: already seen, different campaign id than last
  if (lastShownId) {
    const seenDifferentCampaign = eligible.filter(
      (c) => shownSet.has(c.id) && c.id !== lastShownId,
    );
    const seenCampPick = pickFromPool(seenDifferentCampaign);
    if (seenCampPick) return seenCampPick;
  }

  // 5: no valid rotation target
  return null;
}
