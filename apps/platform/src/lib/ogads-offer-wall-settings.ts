import { randomBytes } from "crypto";
import { clampOfferWallPointsRatio } from "@/lib/offer-wall-points";

export const OGADS_OFFER_WALL_SETTINGS_KEY = "ogads_offer_wall";

export type OgadsOfferWallConfig = {
  version: 1;
  enabled: boolean;
  apiKey: string;
  endpoint: string;
  max: number;
  affiliatePercent: number;
  postbackSecret: string;
  affiliateId: string;
  wallId: string;
  pointsRatio: number;
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
  postbackUrlWithMacros: string;
  affiliateId: string;
  wallId: string;
  pointsRatio: number;
  /** Ready for affiliate attribution when enabled + API key + postback secret. */
  trackingReady: boolean;
};

export const DEFAULT_OGADS_OFFER_WALL_CONFIG: OgadsOfferWallConfig = {
  version: 1,
  enabled: true,
  apiKey: "",
  endpoint: "https://lockerpreview.com/api/v2",
  max: 100,
  affiliatePercent: 100,
  postbackSecret: "",
  affiliateId: "",
  wallId: "",
  // 0 keeps the wall in dollars; a positive ratio shows points instead.
  pointsRatio: 0,
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
    affiliateId: coerceString(raw.affiliateId).trim(),
    wallId: coerceString(raw.wallId).trim(),
    pointsRatio: clampOfferWallPointsRatio(raw.pointsRatio),
  };
}

export function toOgadsOfferWallSettingsApi(
  config: OgadsOfferWallConfig,
  postbackUrl: string,
  postbackUrlWithMacros: string,
): OgadsOfferWallSettingsApi {
  const apiKeyConfigured = Boolean(config.apiKey.trim());
  const postbackSecretConfigured = Boolean(config.postbackSecret.trim());
  return {
    enabled: config.enabled,
    // Never return the stored API key to the browser — only a configured flag.
    apiKey: "",
    apiKeyConfigured,
    endpoint: config.endpoint,
    max: config.max,
    affiliatePercent: config.affiliatePercent,
    postbackSecret: "",
    postbackSecretConfigured,
    postbackUrl,
    postbackUrlWithMacros,
    affiliateId: config.affiliateId,
    wallId: config.wallId,
    pointsRatio: config.pointsRatio,
    trackingReady: Boolean(config.enabled && apiKeyConfigured && postbackSecretConfigured),
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
    affiliateId?: string;
    wallId?: string;
    pointsRatio?: number;
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
  if (typeof input.affiliateId === "string") next.affiliateId = input.affiliateId.trim();
  if (typeof input.wallId === "string") next.wallId = input.wallId.trim();
  if (typeof input.pointsRatio === "number") {
    next.pointsRatio = clampOfferWallPointsRatio(input.pointsRatio);
  }

  return next;
}
