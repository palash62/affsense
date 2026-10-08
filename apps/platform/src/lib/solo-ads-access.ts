import { isSoloAdsAvailableFor, loadSoloAdsConfig, type SoloAdsConfig } from "@cpl/tracking-core";
import { canAccessAdminPath } from "@/lib/admin-portal";
import { AppError, Errors } from "@/lib/errors";

/** Admins always; Platform Managers only with the Solo Ads menu grant. */
export function assertSoloAdminAccess(session: { user: { role: string; staffMenuAccess?: string[] | null } }) {
  if (!canAccessAdminPath("/admin/solo-ads", session.user.role, session.user.staffMenuAccess)) throw Errors.forbidden();
}

export async function getSoloAdsAccess(publisherId: string): Promise<{ config: SoloAdsConfig; available: boolean }> {
  const config = await loadSoloAdsConfig();
  return { config, available: isSoloAdsAvailableFor(config, publisherId) };
}

/** Throws 403 unless Solo Ads is enabled for this affiliate. */
export async function requireSoloAdsAccess(publisherId: string): Promise<SoloAdsConfig> {
  const { config, available } = await getSoloAdsAccess(publisherId);
  if (!available) {
    throw new AppError("SOLO_ADS_UNAVAILABLE", "Solo Ads is not enabled for your account yet", 403);
  }
  return config;
}

export function centsFromDollarsInput(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}
