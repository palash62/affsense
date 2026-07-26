import type { CampaignCategory } from "@prisma/client";

export const URL_TOKENS = [
  { token: "{click_id}", highlight: false },
  { token: "{campaign_id}", highlight: true },
  { token: "{provider_id}", highlight: true },
] as const;

export const VERTICALS = [
  { label: "Make Money Online", category: "GENERIC" as CampaignCategory },
] as const;

export const DEFAULT_VERTICAL = VERTICALS[0].label;

export const COUNTRY_BY_CODE: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
  NZ: "New Zealand",
  IE: "Ireland",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  CH: "Switzerland",
  AT: "Austria",
  BE: "Belgium",
  LU: "Luxembourg",
  SG: "Singapore",
  JP: "Japan",
  IT: "Italy",
  ES: "Spain",
  PT: "Portugal",
  PL: "Poland",
  LV: "Latvia",
  BG: "Bulgaria",
  CZ: "Czech Republic",
  SK: "Slovakia",
  HU: "Hungary",
  RO: "Romania",
  GR: "Greece",
  ZA: "South Africa",
  KR: "South Korea",
  TW: "Taiwan",
  HK: "Hong Kong",
  MY: "Malaysia",
  TH: "Thailand",
  IL: "Israel",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  PE: "Peru",
  PH: "Philippines",
  ID: "Indonesia",
  VN: "Vietnam",
  PK: "Pakistan",
  BD: "Bangladesh",
  NG: "Nigeria",
  EG: "Egypt",
  TR: "Turkey",
  UA: "Ukraine",
  GH: "Ghana",
  KE: "Kenya",
  LK: "Sri Lanka",
  TZ: "Tanzania",
  UG: "Uganda",
  ZM: "Zambia",
};

import { TIER_COUNTRIES, type CountryTier } from "@cpl/shared";

export { TIER_COUNTRIES, type CountryTier };

export const TIER_META: Record<
  CountryTier,
  { label: string; accent: string }
> = {
  tier1: { label: "Tier 1", accent: "border-t-emerald-500" },
  tier2: { label: "Tier 2", accent: "border-t-sky-500" },
  tier3: { label: "Tier 3", accent: "border-t-violet-500" },
};

export function getCountryName(code: string) {
  return COUNTRY_BY_CODE[code] ?? code;
}

export function formatTierCountryList(tier: CountryTier) {
  return TIER_COUNTRIES[tier].map((code) => `${getCountryName(code)} (${code})`);
}

export function countriesFromTiers(tiers: CountryTier[]) {
  return Array.from(new Set(tiers.flatMap((tier) => TIER_COUNTRIES[tier])));
}

export const ALL_TIER_COUNTRY_CODES = Array.from(
  new Set(Object.values(TIER_COUNTRIES).flatMap((codes) => [...codes])),
).sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)));

export function formatSelectedCountriesSummary(codes: string[]) {
  if (codes.length === 0) return "All countries";
  if (codes.length <= 3) {
    return codes.map((code) => getCountryName(code)).join(", ");
  }
  return `${codes.length} countries`;
}

/** @deprecated use formatSelectedCountriesSummary with country codes */
export function formatSelectedCountriesSummaryFromTiers(tiers: CountryTier[]) {
  if (tiers.length === 0) return "All countries";
  return tiers.map((t) => TIER_META[t].label).join(", ");
}

export const DEVICE_TYPES = ["Desktop", "Mobile", "Tablet"] as const;

export const OPERATING_SYSTEMS = [
  "Windows",
  "macOS",
  "iOS",
  "Android",
  "Linux",
  "Chrome OS",
] as const;

import type { PayoutTiersDisplay } from "@/lib/platform-settings";

function roundUsd(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function getActiveTiersFromCountries(countryCodes: string[]): CountryTier[] {
  if (countryCodes.length === 0) {
    return ["tier1", "tier2", "tier3"];
  }

  const tiers = new Set<CountryTier>();
  for (const code of countryCodes) {
    const tier = resolveCountryTier(code);
    if (tier) tiers.add(tier);
  }

  return tiers.size > 0 ? Array.from(tiers) : ["tier1", "tier2", "tier3"];
}

export function resolveCountryTier(code: string): CountryTier | null {
  const upper = code.trim().toUpperCase();
  for (const tier of ["tier1", "tier2", "tier3"] as CountryTier[]) {
    if ((TIER_COUNTRIES[tier] as readonly string[]).includes(upper)) {
      return tier;
    }
  }
  return null;
}

export function hasMultipleCountryTiers(countryCodes: string[]): boolean {
  if (countryCodes.length === 0) return false;
  const tiers = new Set<CountryTier>();
  for (const code of countryCodes) {
    const tier = resolveCountryTier(code);
    if (tier) tiers.add(tier);
  }
  return tiers.size > 1;
}

/** Returns the single tier when all selected countries belong to one tier; otherwise null. */
export function getLockedCountryTier(countryCodes: string[]): CountryTier | null {
  if (countryCodes.length === 0) return null;
  const tiers = new Set<CountryTier>();
  for (const code of countryCodes) {
    const tier = resolveCountryTier(code);
    if (tier) tiers.add(tier);
  }
  return tiers.size === 1 ? Array.from(tiers)[0] : null;
}

export function getFullTierFromSelection(countryCodes: string[]): CountryTier | null {
  if (countryCodes.length === 0) return null;
  for (const tier of ["tier1", "tier2", "tier3"] as CountryTier[]) {
    const tierCodes = TIER_COUNTRIES[tier];
    if (tierCodes.every((code) => countryCodes.includes(code))) {
      return tier;
    }
  }
  return null;
}

export function isTierFullySelectedInList(tier: CountryTier, countryCodes: string[]) {
  return TIER_COUNTRIES[tier].every((code) => countryCodes.includes(code));
}

export function getFullySelectedTiers(countryCodes: string[]): CountryTier[] {
  return (["tier1", "tier2", "tier3"] as CountryTier[]).filter((tier) =>
    isTierFullySelectedInList(tier, countryCodes),
  );
}

/** Returns the tier with a partial selection, if any. */
export function getPartialTierFromSelection(countryCodes: string[]): CountryTier | null {
  if (countryCodes.length === 0) return null;

  const tiersWithCountries = new Set<CountryTier>();
  for (const code of countryCodes) {
    const tier = resolveCountryTier(code);
    if (tier) tiersWithCountries.add(tier);
  }

  for (const tier of tiersWithCountries) {
    if (!isTierFullySelectedInList(tier, countryCodes)) {
      return tier;
    }
  }

  return null;
}

export function hasPartialAndFullTierMix(countryCodes: string[]): boolean {
  const partial = getPartialTierFromSelection(countryCodes);
  const fullTiers = getFullySelectedTiers(countryCodes);
  return partial !== null && fullTiers.length > 0;
}

export function isValidTierCountrySelection(countryCodes: string[]): boolean {
  if (countryCodes.length === 0) return true;
  if (hasPartialAndFullTierMix(countryCodes)) return false;

  const partial = getPartialTierFromSelection(countryCodes);
  if (partial) {
    return countryCodes.every((code) => resolveCountryTier(code) === partial);
  }

  return countryCodes.every((code) => {
    const tier = resolveCountryTier(code);
    return tier !== null && isTierFullySelectedInList(tier, countryCodes);
  });
}

export function isFullTierCountrySelection(countryCodes: string[]): boolean {
  if (countryCodes.length === 0) return true;
  return getFullTierFromSelection(countryCodes) !== null;
}

export const TIER_COUNTRY_GROUPS = (Object.keys(TIER_META) as CountryTier[]).map((tier) => ({
  tier,
  label: TIER_META[tier].label,
  accent: TIER_META[tier].accent,
  countries: [...TIER_COUNTRIES[tier]].sort((a, b) => getCountryName(a).localeCompare(getCountryName(b))),
}));

export function getBidRecommendationsFromTiers(
  payoutTiers: PayoutTiersDisplay,
  selectedCountries: string[],
) {
  const activeTiers = getActiveTiersFromCountries(selectedCountries);
  const ranges = activeTiers.map((tier) => {
    if (tier === "tier1") {
      return { min: payoutTiers.tier1PayoutMin, max: payoutTiers.tier1PayoutMax };
    }
    if (tier === "tier2") {
      return { min: payoutTiers.tier2PayoutMin, max: payoutTiers.tier2PayoutMax };
    }
    return { min: payoutTiers.tier3PayoutMin, max: payoutTiers.tier3PayoutMax };
  });

  const payoutMin = Math.min(...ranges.map((range) => range.min));
  const payoutMax = Math.max(...ranges.map((range) => range.max));
  const payoutMid = roundUsd((payoutMin + payoutMax) / 2);

  return {
    minimum: payoutMin,
    optimal: payoutMid,
    maximum: payoutMax,
    payoutMin,
    payoutMax,
    activeTiers,
  };
}

/** @deprecated use getBidRecommendationsFromTiers */
export function getBidRecommendations(cpl: number) {
  const base = Number.isFinite(cpl) && cpl > 0 ? cpl : 1;
  return {
    minimum: Math.round(base * 0.31 * 100) / 100,
    optimal: Math.round(base * 0.41 * 100) / 100,
    maximum: Math.round(base * 0.52 * 100) / 100,
  };
}

export function formatSummaryDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export const DEFAULT_LEAD_FIELDS = [
  { fieldName: "first_name", label: "First Name", fieldType: "text", required: true },
  { fieldName: "email", label: "Email", fieldType: "email", required: true },
  { fieldName: "phone", label: "Phone", fieldType: "phone", required: true },
] as const;
