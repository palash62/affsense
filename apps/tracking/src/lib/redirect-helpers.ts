import { TIER_COUNTRIES, type CountryTier } from "./tiers";
import { resolveCountryTier } from "./platform-settings";

export type PublisherSpecialTierPayouts = {
  enabled: boolean;
  tier1: number | null;
  tier2: number | null;
  tier3: number | null;
};

export type PublisherSpecialPayoutProfile = {
  useSpecialTierPayouts?: boolean;
  tier1SpecialPayout?: unknown;
  tier2SpecialPayout?: unknown;
  tier3SpecialPayout?: unknown;
};

function readAmount(value: unknown): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function readPublisherSpecialTierPayouts(
  profile: PublisherSpecialPayoutProfile | null | undefined,
): PublisherSpecialTierPayouts {
  return {
    enabled: Boolean(profile?.useSpecialTierPayouts),
    tier1: readAmount(profile?.tier1SpecialPayout),
    tier2: readAmount(profile?.tier2SpecialPayout),
    tier3: readAmount(profile?.tier3SpecialPayout),
  };
}

export function campaignQualifiesForSpecialPayouts(
  publisherAmountByTier: (tier: CountryTier, sampleCountry: string) => number,
  payouts: PublisherSpecialTierPayouts,
  countryCode: string | null | undefined,
): boolean {
  if (!payouts.enabled) return true;

  if (countryCode) {
    const tier = resolveCountryTier(countryCode);
    if (!tier) return true;
    const min = payouts[tier];
    if (min == null) return true;
    return publisherAmountByTier(tier, countryCode) >= min;
  }

  let hasRule = false;
  for (const tier of ["tier1", "tier2", "tier3"] as CountryTier[]) {
    const min = payouts[tier];
    if (min == null) continue;
    hasRule = true;
    const sampleCountry = TIER_COUNTRIES[tier][0];
    if (publisherAmountByTier(tier, sampleCountry) >= min) {
      return true;
    }
  }

  return !hasRule;
}

export {
  campaignExcludesBlockedPublishers,
  filterCampaignsByCountry,
  filterCampaignsByDeviceOs,
  pickCampaignForIpRotation,
} from "./smart-link-rotation";
