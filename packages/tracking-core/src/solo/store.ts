import { randomUUID } from "node:crypto";
import { prisma } from "@cpl/database";
import type { Prisma } from "@prisma/client";
import { parseSoloAdsConfig, SOLO_ADS_SETTINGS_KEY, type SoloAdsConfig } from "./settings";

export type SoloTx = Prisma.TransactionClient;

export async function loadSoloAdsConfig(): Promise<SoloAdsConfig> {
  const row = await prisma.platformSetting.findUnique({ where: { key: SOLO_ADS_SETTINGS_KEY } });
  return parseSoloAdsConfig(row?.value);
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Get-or-create the affiliate's advertising wallet. */
export async function ensureSoloWallet(publisherId: string, tx: SoloTx | typeof prisma = prisma) {
  const existing = await tx.soloWallet.findUnique({ where: { publisherId } });
  if (existing) return existing;
  try {
    return await tx.soloWallet.create({ data: { publisherId } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return tx.soloWallet.findUniqueOrThrow({ where: { publisherId } });
  }
}

export type StatsIncrement = {
  clicks?: number;
  billedClicks?: number;
  invalidClicks?: number;
  spendCents?: number;
  leads?: number;
  conversions?: number;
  commissionCents?: number;
  reversedCents?: number;
};

/** Add to the campaign x provider x local-date rollup. */
export async function bumpSoloStats(
  tx: SoloTx,
  key: { campaignId: string; providerId: string; localDate: string },
  inc: StatsIncrement,
) {
  const data = {
    clicks: inc.clicks ?? 0,
    billedClicks: inc.billedClicks ?? 0,
    invalidClicks: inc.invalidClicks ?? 0,
    spendCents: inc.spendCents ?? 0,
    leads: inc.leads ?? 0,
    conversions: inc.conversions ?? 0,
    commissionCents: inc.commissionCents ?? 0,
    reversedCents: inc.reversedCents ?? 0,
  };
  await tx.$executeRaw`
    INSERT INTO solo_daily_stats
      (id, campaign_id, provider_id, local_date, clicks, billed_clicks, invalid_clicks, spend_cents, leads, conversions, commission_cents, reversed_cents)
    VALUES
      (${randomUUID()}, ${key.campaignId}, ${key.providerId}, ${key.localDate}, ${data.clicks}, ${data.billedClicks},
       ${data.invalidClicks}, ${data.spendCents}, ${data.leads}, ${data.conversions}, ${data.commissionCents}, ${data.reversedCents})
    ON DUPLICATE KEY UPDATE
      clicks = clicks + VALUES(clicks),
      billed_clicks = billed_clicks + VALUES(billed_clicks),
      invalid_clicks = invalid_clicks + VALUES(invalid_clicks),
      spend_cents = spend_cents + VALUES(spend_cents),
      leads = leads + VALUES(leads),
      conversions = conversions + VALUES(conversions),
      commission_cents = commission_cents + VALUES(commission_cents),
      reversed_cents = reversed_cents + VALUES(reversed_cents)`;
}
