import { randomBytes } from "crypto";

export const OGADS_OFFER_WALL_SETTINGS_KEY = "ogads_offer_wall";

export type OgadsOfferWallConfig = {
  version: 1;
  enabled: boolean;
  apiKey: string;
  endpoint: string;
  max: number;
  affiliatePercent: number;
  postbackSecret: string;
};

export type OgadsOfferWallSettingsApi = {
  enabled: boolean;
  apiKey: string;
  apiKeyConfigured: boolean;
  endpoint: string;
  max: number;
  affiliatePercent: number;
  postbackSecret: string;
  postbackSecretConfigured: boolean;
  postbackUrl: string;
};

export const DEFAULT_OGADS_OFFER_WALL_CONFIG: OgadsOfferWallConfig = {
  version: 1,
  enabled: true,
  apiKey: "",
  endpoint: "https://lockerpreview.com/api/v2",
  max: 100,
  affiliatePercent: 100,
  postbackSecret: "",
};

export function clampOfferWallAffiliatePercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_OGADS_OFFER_WALL_CONFIG.affiliatePercent;
  return Math.min(100, Math.max(1, Math.round(n)));
}

export function applyOfferWallAffiliatePayout(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const share = clampOfferWallAffiliatePercent(percent) / 100;
  return Math.round(amount * share * 10_000) / 10_000;
}

export function generateOfferWallSecret(): string {
  return randomBytes(24).toString("hex");
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseOgadsOfferWallConfig(value: unknown): OgadsOfferWallConfig {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_OGADS_OFFER_WALL_CONFIG };
  }
  const raw = value as Record<string, unknown>;
  const maxRaw = Number(raw.max);
  return {
    version: 1,
    enabled: raw.enabled !== false,
    apiKey: coerceString(raw.apiKey).trim(),
    endpoint:
      coerceString(raw.endpoint).trim() || DEFAULT_OGADS_OFFER_WALL_CONFIG.endpoint,
    max:
      Number.isFinite(maxRaw) && maxRaw > 0
        ? Math.min(200, Math.floor(maxRaw))
        : DEFAULT_OGADS_OFFER_WALL_CONFIG.max,
    affiliatePercent: clampOfferWallAffiliatePercent(
      raw.affiliatePercent ?? DEFAULT_OGADS_OFFER_WALL_CONFIG.affiliatePercent,
    ),
    postbackSecret: coerceString(raw.postbackSecret).trim(),
  };
}

export function toOgadsOfferWallSettingsApi(
  config: OgadsOfferWallConfig,
  postbackUrl: string,
): OgadsOfferWallSettingsApi {
  return {
    enabled: config.enabled,
    // Never return the stored API key to the browser — only a configured flag.
    apiKey: "",
    apiKeyConfigured: Boolean(config.apiKey.trim()),
    endpoint: config.endpoint,
    max: config.max,
    affiliatePercent: config.affiliatePercent,
    postbackSecret: "",
    postbackSecretConfigured: Boolean(config.postbackSecret.trim()),
    postbackUrl,
  };
}

export function mergeOgadsOfferWallUpdate(
  existing: OgadsOfferWallConfig,
  input: {
    enabled?: boolean;
    apiKey?: string;
    endpoint?: string;
    max?: number;
    affiliatePercent?: number;
    postbackSecret?: string;
    regenerateSecret?: boolean;
  },
): OgadsOfferWallConfig {
  const next: OgadsOfferWallConfig = { ...existing };

  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  if (typeof input.apiKey === "string") next.apiKey = input.apiKey.trim();
  if (typeof input.endpoint === "string" && input.endpoint.trim()) {
    next.endpoint = input.endpoint.trim().replace(/\/$/, "");
  }
  if (typeof input.max === "number" && Number.isFinite(input.max) && input.max > 0) {
    next.max = Math.min(200, Math.floor(input.max));
  }
  if (typeof input.affiliatePercent === "number" && Number.isFinite(input.affiliatePercent)) {
    next.affiliatePercent = clampOfferWallAffiliatePercent(input.affiliatePercent);
  }
  if (input.regenerateSecret) {
    next.postbackSecret = generateOfferWallSecret();
  } else if (typeof input.postbackSecret === "string" && input.postbackSecret.trim()) {
    next.postbackSecret = input.postbackSecret.trim();
  }

  return next;
}
