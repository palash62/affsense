import type { Campaign } from "@prisma/client";
import { TIER_COUNTRIES, type CountryTier } from "./tiers";

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

  const unseen = eligible.filter((c) => !shownSet.has(c.id));
  const unseenPick = pickFromPool(preferDifferentAdvertiser(unseen));
  if (unseenPick) return unseenPick;

  if (lastAdvertiserId) {
    const seenDifferentAdvertiser = eligible.filter(
      (c) => shownSet.has(c.id) && c.advertiserId !== lastAdvertiserId,
    );
    const seenAdvPick = pickFromPool(seenDifferentAdvertiser);
    if (seenAdvPick) return seenAdvPick;
  }

  if (lastShownId) {
    const seenDifferentCampaign = eligible.filter(
      (c) => shownSet.has(c.id) && c.id !== lastShownId,
    );
    const seenCampPick = pickFromPool(seenDifferentCampaign);
    if (seenCampPick) return seenCampPick;
  }

  return null;
}

export function campaignExcludesBlockedPublishers(targeting: unknown): boolean {
  if (!targeting || typeof targeting !== "object") return false;
  return Boolean((targeting as Record<string, unknown>).excludeBlockedPublishers);
}

export function resolveCountryTier(countryCode: string | null | undefined): CountryTier | null {
  if (!countryCode?.trim()) return null;
  const code = countryCode.trim().toUpperCase();
  for (const tier of ["tier1", "tier2", "tier3"] as CountryTier[]) {
    if ((TIER_COUNTRIES[tier] as readonly string[]).includes(code)) {
      return tier;
    }
  }
  return null;
}
