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

export function buildOgadsPostbackUrl(secret?: string) {
  const base = `${getPlatformUrl().replace(/\/$/, "")}/api/v1/webhooks/ogads`;
  const key = secret?.trim();
  if (!key) return base;
  return `${base}?secret=${encodeURIComponent(key)}`;
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
  return toOgadsOfferWallSettingsApi(config, buildOgadsPostbackUrl(config.postbackSecret));
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
        apiKeyUpdated: typeof input.apiKey === "string",
        secretRotated: Boolean(input.regenerateSecret),
        secretUpdated: Boolean(
          input.regenerateSecret ||
            (typeof input.postbackSecret === "string" && input.postbackSecret.trim()),
        ),
      },
    },
  });

  return toOgadsOfferWallSettingsApi(next, buildOgadsPostbackUrl(next.postbackSecret));
}
