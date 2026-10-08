export const SOLO_ADS_SETTINGS_KEY = "solo_ads";

export type SoloAdsConfig = {
  version: 1;
  /** Master switch for the whole module (routing, campaigns, deposits). */
  enabled: boolean;
  /** When true, only publishers in betaPublisherIds can use Solo Ads. */
  betaOnly: boolean;
  betaPublisherIds: string[];
  regularCpcCents: number;
  warmCpcCents: number;
  minDepositCents: number;
  minDailyBudgetCents: number;
  maxDailyBudgetCents: number;
  /** ISO-2 country codes affiliates may target and the router accepts. */
  supportedCountries: string[];
  attributionWindowDays: number;
  /** A visitor (IP) is routed to the same campaign at most once per window. */
  uniqueVisitorWindowHours: number;
  /** Clicks stay reserved this long before being charged or released. */
  validationDelayMinutes: number;
  /** More clicks than this from one IP within an hour are invalid. */
  maxClicksPerIpPerHour: number;
  /** Per provider token; extra requests go to the non-billable fallback. */
  maxClicksPerTokenPerMinute: number;
  blockBots: boolean;
  /** Non-billable destination when no campaign is eligible or traffic is invalid. */
  fallbackUrl: string;
  defaultTimezone: string;
  transferEnabled: boolean;
  /** Alert affiliates when spendable balance drops below this. */
  lowBalanceAlertCents: number;
  /** Days a CPA conversion stays PENDING before it is approved. */
  cpaApprovalDays: number;
};

export const DEFAULT_SOLO_ADS_CONFIG: SoloAdsConfig = {
  version: 1,
  enabled: false,
  betaOnly: true,
  betaPublisherIds: [],
  regularCpcCents: 45,
  warmCpcCents: 75,
  minDepositCents: 2500,
  minDailyBudgetCents: 1000,
  maxDailyBudgetCents: 500000,
  supportedCountries: ["US", "CA", "GB", "AU", "NZ", "IE"],
  attributionWindowDays: 30,
  uniqueVisitorWindowHours: 24,
  validationDelayMinutes: 10,
  maxClicksPerIpPerHour: 3,
  maxClicksPerTokenPerMinute: 600,
  blockBots: true,
  fallbackUrl: "https://affsense.com",
  defaultTimezone: "UTC",
  transferEnabled: true,
  lowBalanceAlertCents: 1000,
  cpaApprovalDays: 7,
};

function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function countryList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out: string[] = [];
  for (const v of value) {
    const code = typeof v === "string" ? v.trim().toUpperCase() : "";
    if (/^[A-Z]{2}$/.test(code) && !out.includes(code)) out.push(code);
  }
  return out;
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()))];
}

export function parseSoloAdsConfig(value: unknown): SoloAdsConfig {
  const d = DEFAULT_SOLO_ADS_CONFIG;
  if (!value || typeof value !== "object") return { ...d, betaPublisherIds: [], supportedCountries: [...d.supportedCountries] };
  const raw = value as Record<string, unknown>;
  const minDaily = int(raw.minDailyBudgetCents, d.minDailyBudgetCents, 100, 10_000_000);
  const fallback = typeof raw.fallbackUrl === "string" && /^https:\/\//i.test(raw.fallbackUrl.trim())
    ? raw.fallbackUrl.trim()
    : d.fallbackUrl;
  return {
    version: 1,
    enabled: raw.enabled === true,
    betaOnly: raw.betaOnly !== false,
    betaPublisherIds: idList(raw.betaPublisherIds),
    regularCpcCents: int(raw.regularCpcCents, d.regularCpcCents, 1, 100_000),
    warmCpcCents: int(raw.warmCpcCents, d.warmCpcCents, 1, 100_000),
    minDepositCents: int(raw.minDepositCents, d.minDepositCents, 100, 10_000_000),
    minDailyBudgetCents: minDaily,
    maxDailyBudgetCents: Math.max(minDaily, int(raw.maxDailyBudgetCents, d.maxDailyBudgetCents, 100, 100_000_000)),
    supportedCountries: countryList(raw.supportedCountries, [...d.supportedCountries]),
    attributionWindowDays: int(raw.attributionWindowDays, d.attributionWindowDays, 1, 365),
    uniqueVisitorWindowHours: int(raw.uniqueVisitorWindowHours, d.uniqueVisitorWindowHours, 1, 24 * 30),
    validationDelayMinutes: int(raw.validationDelayMinutes, d.validationDelayMinutes, 0, 24 * 60),
    maxClicksPerIpPerHour: int(raw.maxClicksPerIpPerHour, d.maxClicksPerIpPerHour, 1, 1000),
    maxClicksPerTokenPerMinute: int(raw.maxClicksPerTokenPerMinute, d.maxClicksPerTokenPerMinute, 1, 100_000),
    blockBots: raw.blockBots !== false,
    fallbackUrl: fallback,
    defaultTimezone: typeof raw.defaultTimezone === "string" && raw.defaultTimezone.trim() ? raw.defaultTimezone.trim() : d.defaultTimezone,
    transferEnabled: raw.transferEnabled !== false,
    lowBalanceAlertCents: int(raw.lowBalanceAlertCents, d.lowBalanceAlertCents, 0, 10_000_000),
    cpaApprovalDays: int(raw.cpaApprovalDays, d.cpaApprovalDays, 0, 90),
  };
}

export function cpcCentsForTraffic(config: SoloAdsConfig, trafficType: "REGULAR" | "WARM"): number {
  return trafficType === "WARM" ? config.warmCpcCents : config.regularCpcCents;
}

/** Whether a publisher may open the Solo Ads module. */
export function isSoloAdsAvailableFor(config: SoloAdsConfig, publisherId: string): boolean {
  if (!config.enabled) return false;
  return !config.betaOnly || config.betaPublisherIds.includes(publisherId);
}
