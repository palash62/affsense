import { prisma } from "@/lib/prisma";
import { getPlatformUrl } from "@cpl/shared";
import {
  DEFAULT_OGADS_OFFER_WALL_CONFIG,
  mergeOgadsOfferWallUpdate,
  OGADS_OFFER_WALL_SETTINGS_KEY,
  parseOgadsOfferWallConfig,
  toOgadsOfferWallSettingsApi,
  type OgadsOfferWallConfig,
} from "@/lib/ogads-offer-wall-settings";

const OFFER_WALL_PUBLIC_ORIGIN = "https://affsense.com";

function isLocalPlatformUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** Public origin shown in Settings → Offer Wall postback URLs. */
export function getOgadsPostbackOrigin(): string {
  const platform = getPlatformUrl().replace(/\/$/, "");
  return isLocalPlatformUrl(platform) ? platform : OFFER_WALL_PUBLIC_ORIGIN;
}

export function buildOgadsPostbackUrl(secret?: string) {
  const base = `${getOgadsPostbackOrigin()}/api/v1/webhooks/ogads`;
  const key = secret?.trim();
  if (!key) return base;
  return `${base}?secret=${encodeURIComponent(key)}`;
}

/**
 * Postback URL pre-filled with OGAds macros, ready to paste into
 * members.ogads.com -> Tools -> Postback URL.
 */
export function buildOgadsPostbackUrlWithMacros(secret?: string) {
  const macros = [
    "offer_id={offer_id}",
    "payout={payout}",
    "aff_sub4={aff_sub4}",
    "ip={session_ip}",
    "transaction_id={transaction_id}",
  ].join("&");
  const base = buildOgadsPostbackUrl(secret);
  return `${base}${base.includes("?") ? "&" : "?"}${macros}`;
}

export async function loadOgadsOfferWallConfig(): Promise<OgadsOfferWallConfig> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: OGADS_OFFER_WALL_SETTINGS_KEY },
  });
  if (!row) return { ...DEFAULT_OGADS_OFFER_WALL_CONFIG };
  return parseOgadsOfferWallConfig(row.value);
}

export async function getOgadsOfferWallSettingsForAdmin() {
  const config = await loadOgadsOfferWallConfig();
  return toOgadsOfferWallSettingsApi(
    config,
    buildOgadsPostbackUrl(config.postbackSecret),
    buildOgadsPostbackUrlWithMacros(config.postbackSecret),
  );
}

export async function updateOgadsOfferWallSettings(
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
  adminId: string,
) {
  const existing = await loadOgadsOfferWallConfig();
  const next = mergeOgadsOfferWallUpdate(existing, input);

  await prisma.platformSetting.upsert({
    where: { key: OGADS_OFFER_WALL_SETTINGS_KEY },
    create: { key: OGADS_OFFER_WALL_SETTINGS_KEY, value: next as never },
    update: { value: next as never },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "ogads.offer_wall.settings.updated",
      entityType: "platform_settings",
      entityId: OGADS_OFFER_WALL_SETTINGS_KEY,
      metadata: {
        enabled: next.enabled,
        endpoint: next.endpoint,
        max: next.max,
        affiliatePercent: next.affiliatePercent,
        affiliateId: next.affiliateId,
        wallId: next.wallId,
        pointsRatio: next.pointsRatio,
        apiKeyUpdated: typeof input.apiKey === "string",
        secretRotated: Boolean(input.regenerateSecret),
        secretUpdated: Boolean(
          input.regenerateSecret ||
            (typeof input.postbackSecret === "string" && input.postbackSecret.trim()),
        ),
      },
    },
  });

  return toOgadsOfferWallSettingsApi(
    next,
    buildOgadsPostbackUrl(next.postbackSecret),
    buildOgadsPostbackUrlWithMacros(next.postbackSecret),
  );
}
