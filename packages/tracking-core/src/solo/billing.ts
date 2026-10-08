import { randomUUID } from "node:crypto";
import { prisma } from "@cpl/database";
import { postSoloLedgerEntry } from "./ledger";
import { utcDate } from "./pacing";
import type { SoloAdsConfig } from "./settings";
import { bumpSoloStats, type SoloTx } from "./store";

export class SoloReservationFailed extends Error {
  constructor(public reason: string) {
    super(`SOLO_RESERVATION_FAILED:${reason}`);
    this.name = "SoloReservationFailed";
  }
}

/**
 * Reserve one click's CPC against wallet, daily cap, lifetime cap and provider
 * capacity. Every check is a conditional UPDATE, so two concurrent redirects
 * can never overspend. Throws SoloReservationFailed (rolling back the tx).
 */
export async function reserveSoloClick(
  tx: SoloTx,
  input: {
    campaignId: string;
    publisherId: string;
    providerId: string;
    providerDailyCapacity: number | null;
    cpcCents: number;
    dailyBudgetCents: number;
    localDate: string;
    at: Date;
  },
) {
  const cpc = input.cpcCents;

  const wallet = await tx.$executeRaw`
    UPDATE solo_wallets
    SET reserved_cents = reserved_cents + ${cpc}, version = version + 1
    WHERE publisher_id = ${input.publisherId}
      AND balance_cents - reserved_cents >= ${cpc}`;
  if (wallet !== 1) throw new SoloReservationFailed("insufficient_funds");

  await tx.$executeRaw`
    INSERT INTO solo_daily_usage (id, campaign_id, local_date, reserved_cents, spent_cents, paid_clicks)
    VALUES (${randomUUID()}, ${input.campaignId}, ${input.localDate}, 0, 0, 0)
    ON DUPLICATE KEY UPDATE id = id`;
  const daily = await tx.$executeRaw`
    UPDATE solo_daily_usage
    SET reserved_cents = reserved_cents + ${cpc}
    WHERE campaign_id = ${input.campaignId}
      AND local_date = ${input.localDate}
      AND reserved_cents + spent_cents + ${cpc} <= ${input.dailyBudgetCents}`;
  if (daily !== 1) throw new SoloReservationFailed("daily_budget");

  const lifetime = await tx.$executeRaw`
    UPDATE solo_campaigns
    SET reserved_cents = reserved_cents + ${cpc}
    WHERE id = ${input.campaignId}
      AND status = 'ACTIVE'
      AND spent_cents + reserved_cents + ${cpc} <= lifetime_budget_cents`;
  if (lifetime !== 1) throw new SoloReservationFailed("lifetime_budget");

  await reserveProviderCapacity(tx, input.providerId, input.providerDailyCapacity, input.at);
}

export async function reserveProviderCapacity(
  tx: SoloTx,
  providerId: string,
  capacity: number | null,
  at: Date,
) {
  const date = utcDate(at);
  await tx.$executeRaw`
    INSERT INTO solo_provider_daily_usage (id, provider_id, date, clicks)
    VALUES (${randomUUID()}, ${providerId}, ${date}, 0)
    ON DUPLICATE KEY UPDATE id = id`;
  const updated = capacity == null
    ? await tx.$executeRaw`
        UPDATE solo_provider_daily_usage SET clicks = clicks + 1
        WHERE provider_id = ${providerId} AND date = ${date}`
    : await tx.$executeRaw`
        UPDATE solo_provider_daily_usage SET clicks = clicks + 1
        WHERE provider_id = ${providerId} AND date = ${date} AND clicks < ${capacity}`;
  if (updated !== 1) throw new SoloReservationFailed("provider_capacity");
}

export type FinalizeDecision = { billable: true } | { billable: false; reason: string };

/**
 * Charge (BILLED) or release (INVALID) one PENDING click. Safe to call twice:
 * only the call that flips the status from PENDING moves money.
 */
export async function finalizeSoloClick(clickId: string, decision: FinalizeDecision, at = new Date()) {
  return prisma.$transaction(async (tx) => {
    const click = await tx.soloClick.findUnique({
      where: { id: clickId },
      select: {
        id: true,
        campaignId: true,
        providerId: true,
        publisherId: true,
        chargeCents: true,
        localDate: true,
        billingStatus: true,
      },
    });
    if (!click || click.billingStatus !== "PENDING" || !click.campaignId || !click.publisherId) return null;

    const flipped = await tx.soloClick.updateMany({
      where: { id: clickId, billingStatus: "PENDING" },
      data: decision.billable
        ? { billingStatus: "BILLED", finalizedAt: at }
        : { billingStatus: "INVALID", invalidReason: decision.reason, finalizedAt: at },
    });
    if (flipped.count !== 1) return null;

    const cpc = click.chargeCents;
    const localDate = click.localDate ?? utcDate(at);
    const wallet = await tx.soloWallet.findUniqueOrThrow({
      where: { publisherId: click.publisherId },
      select: { id: true },
    });

    if (decision.billable) {
      await postSoloLedgerEntry(tx, {
        walletId: wallet.id,
        type: "CHARGE",
        amountCents: -cpc,
        idempotencyKey: `charge:${click.id}`,
        sourceType: "solo_click",
        sourceId: click.id,
        releaseReservedCents: cpc,
      });
      await tx.$executeRaw`
        UPDATE solo_daily_usage
        SET reserved_cents = GREATEST(reserved_cents - ${cpc}, 0),
            spent_cents = spent_cents + ${cpc},
            paid_clicks = paid_clicks + 1
        WHERE campaign_id = ${click.campaignId} AND local_date = ${localDate}`;
      await tx.$executeRaw`
        UPDATE solo_campaigns
        SET reserved_cents = GREATEST(reserved_cents - ${cpc}, 0),
            spent_cents = spent_cents + ${cpc},
            paid_clicks = paid_clicks + 1
        WHERE id = ${click.campaignId}`;
      await bumpSoloStats(
        tx,
        { campaignId: click.campaignId, providerId: click.providerId, localDate },
        { billedClicks: 1, spendCents: cpc },
      );
    } else {
      await tx.$executeRaw`
        UPDATE solo_wallets
        SET reserved_cents = GREATEST(reserved_cents - ${cpc}, 0), version = version + 1
        WHERE id = ${wallet.id}`;
      await tx.$executeRaw`
        UPDATE solo_daily_usage
        SET reserved_cents = GREATEST(reserved_cents - ${cpc}, 0)
        WHERE campaign_id = ${click.campaignId} AND local_date = ${localDate}`;
      await tx.$executeRaw`
        UPDATE solo_campaigns
        SET reserved_cents = GREATEST(reserved_cents - ${cpc}, 0)
        WHERE id = ${click.campaignId}`;
      await bumpSoloStats(
        tx,
        { campaignId: click.campaignId, providerId: click.providerId, localDate },
        { invalidClicks: 1 },
      );
    }
    return decision.billable ? "BILLED" : "INVALID";
  });
}

/** Refund a BILLED click (dispute / late invalid-traffic finding). Idempotent. */
export async function refundSoloClick(clickId: string, input: { actorId: string; reason: string }, at = new Date()) {
  return prisma.$transaction(async (tx) => {
    const click = await tx.soloClick.findUnique({
      where: { id: clickId },
      select: { id: true, campaignId: true, providerId: true, publisherId: true, chargeCents: true, localDate: true, billingStatus: true },
    });
    if (!click || click.billingStatus !== "BILLED" || !click.campaignId || !click.publisherId) return null;
    const flipped = await tx.soloClick.updateMany({
      where: { id: clickId, billingStatus: "BILLED" },
      data: { billingStatus: "REFUNDED", invalidReason: input.reason.slice(0, 191) },
    });
    if (flipped.count !== 1) return null;
    const cpc = click.chargeCents;
    const localDate = click.localDate ?? utcDate(at);
    const wallet = await tx.soloWallet.findUniqueOrThrow({ where: { publisherId: click.publisherId }, select: { id: true } });
    await postSoloLedgerEntry(tx, {
      walletId: wallet.id,
      type: "REFUND",
      amountCents: cpc,
      idempotencyKey: `refund:${click.id}`,
      sourceType: "solo_click",
      sourceId: click.id,
      actorId: input.actorId,
      reason: input.reason,
    });
    await tx.$executeRaw`
      UPDATE solo_daily_usage
      SET spent_cents = GREATEST(spent_cents - ${cpc}, 0), paid_clicks = GREATEST(paid_clicks - 1, 0)
      WHERE campaign_id = ${click.campaignId} AND local_date = ${localDate}`;
    await tx.$executeRaw`
      UPDATE solo_campaigns
      SET spent_cents = GREATEST(spent_cents - ${cpc}, 0), paid_clicks = GREATEST(paid_clicks - 1, 0)
      WHERE id = ${click.campaignId}`;
    await bumpSoloStats(
      tx,
      { campaignId: click.campaignId, providerId: click.providerId, localDate },
      { billedClicks: -1, invalidClicks: 1, spendCents: -cpc },
    );
    return click.id;
  });
}

/** Post-click validity checks that need a few minutes of hindsight. */
export async function decideSoloClick(
  click: { id: string; ipHash: string; createdAt: Date; campaignId: string | null },
  config: SoloAdsConfig,
): Promise<FinalizeDecision> {
  if (!click.campaignId) return { billable: false, reason: "no_campaign" };
  const campaign = await prisma.soloCampaign.findUnique({
    where: { id: click.campaignId },
    select: { id: true },
  });
  if (!campaign) return { billable: false, reason: "campaign_deleted" };

  const hour = 60 * 60 * 1000;
  const sameIp = await prisma.soloClick.count({
    where: {
      ipHash: click.ipHash,
      createdAt: { gte: new Date(click.createdAt.getTime() - hour), lte: new Date(click.createdAt.getTime() + hour) },
    },
  });
  if (sameIp > config.maxClicksPerIpPerHour) return { billable: false, reason: "ip_velocity" };
  return { billable: true };
}

/** Finalize PENDING clicks older than the validation delay. Returns counts. */
export async function finalizeDueSoloClicks(config: SoloAdsConfig, now = new Date(), limit = 500) {
  const cutoff = new Date(now.getTime() - config.validationDelayMinutes * 60 * 1000);
  const due = await prisma.soloClick.findMany({
    where: { billingStatus: "PENDING", createdAt: { lte: cutoff } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, ipHash: true, createdAt: true, campaignId: true },
  });
  let billed = 0;
  let invalid = 0;
  for (const click of due) {
    try {
      const decision = await decideSoloClick(click, config);
      const result = await finalizeSoloClick(click.id, decision, now);
      if (result === "BILLED") billed += 1;
      if (result === "INVALID") invalid += 1;
    } catch (error) {
      console.error("[solo] finalize failed", click.id, error);
    }
  }
  return { processed: due.length, billed, invalid };
}
