import { prisma } from "@cpl/database";

export type SoloStatusChange = {
  campaignId: string;
  publisherId: string;
  name: string;
  from: string;
  to: "COMPLETED" | "BUDGET_EXHAUSTED" | "INSUFFICIENT_FUNDS" | "ACTIVE";
};

const ENDABLE = ["ACTIVE", "PAUSED", "INSUFFICIENT_FUNDS", "BUDGET_EXHAUSTED"] as const;

/**
 * Move campaigns between running states. Every transition is a conditional
 * update on the expected current status, so concurrent sweeps (or an affiliate
 * pausing at the same moment) never double-apply. Returns the transitions made.
 */
export async function sweepSoloCampaignStatuses(now = new Date()): Promise<SoloStatusChange[]> {
  const changes: SoloStatusChange[] = [];

  const ended = await prisma.soloCampaign.findMany({
    where: { status: { in: [...ENDABLE] }, endAt: { lte: now } },
    select: { id: true, publisherId: true, name: true, status: true },
    take: 500,
  });
  for (const c of ended) {
    const res = await prisma.soloCampaign.updateMany({
      where: { id: c.id, status: c.status },
      data: { status: "COMPLETED", statusReason: "The campaign reached its end date." },
    });
    if (res.count) changes.push({ campaignId: c.id, publisherId: c.publisherId, name: c.name, from: c.status, to: "COMPLETED" });
  }

  const exhausted = await prisma.$queryRaw<Array<{ id: string; publisherId: string; name: string }>>`
    SELECT id, publisher_id AS publisherId, name FROM solo_campaigns
    WHERE status = 'ACTIVE' AND spent_cents + cpc_cents_snapshot > lifetime_budget_cents
    LIMIT 500`;
  for (const c of exhausted) {
    const res = await prisma.$executeRaw`
      UPDATE solo_campaigns
      SET status = 'BUDGET_EXHAUSTED', status_reason = 'The total budget has been spent. Raise it to keep running.'
      WHERE id = ${c.id} AND status = 'ACTIVE' AND spent_cents + cpc_cents_snapshot > lifetime_budget_cents`;
    if (res) changes.push({ campaignId: c.id, publisherId: c.publisherId, name: c.name, from: "ACTIVE", to: "BUDGET_EXHAUSTED" });
  }

  // Pause when the balance itself (not just the spendable part) cannot cover a click,
  // and resume only once a click is spendable again; the gap avoids flapping.
  const unfunded = await prisma.$queryRaw<Array<{ id: string; publisherId: string; name: string }>>`
    SELECT c.id, c.publisher_id AS publisherId, c.name FROM solo_campaigns c
    JOIN solo_wallets w ON w.publisher_id = c.publisher_id
    WHERE c.status = 'ACTIVE' AND w.balance_cents < c.cpc_cents_snapshot
    LIMIT 500`;
  for (const c of unfunded) {
    const res = await prisma.$executeRaw`
      UPDATE solo_campaigns c JOIN solo_wallets w ON w.publisher_id = c.publisher_id
      SET c.status = 'INSUFFICIENT_FUNDS', c.status_reason = 'Your ad wallet does not have enough funds for another click.'
      WHERE c.id = ${c.id} AND c.status = 'ACTIVE' AND w.balance_cents < c.cpc_cents_snapshot`;
    if (res) changes.push({ campaignId: c.id, publisherId: c.publisherId, name: c.name, from: "ACTIVE", to: "INSUFFICIENT_FUNDS" });
  }

  changes.push(...(await resumeFundedSoloCampaigns(undefined, now)));
  return changes;
}

/** Re-activate INSUFFICIENT_FUNDS campaigns whose wallet can pay for a click again. */
export async function resumeFundedSoloCampaigns(publisherId?: string, now = new Date()): Promise<SoloStatusChange[]> {
  const rows = publisherId
    ? await prisma.$queryRaw<Array<{ id: string; publisherId: string; name: string }>>`
        SELECT c.id, c.publisher_id AS publisherId, c.name FROM solo_campaigns c
        JOIN solo_wallets w ON w.publisher_id = c.publisher_id
        WHERE c.publisher_id = ${publisherId} AND c.status = 'INSUFFICIENT_FUNDS'
          AND w.balance_cents - w.reserved_cents >= c.cpc_cents_snapshot
          AND (c.end_at IS NULL OR c.end_at > ${now})`
    : await prisma.$queryRaw<Array<{ id: string; publisherId: string; name: string }>>`
        SELECT c.id, c.publisher_id AS publisherId, c.name FROM solo_campaigns c
        JOIN solo_wallets w ON w.publisher_id = c.publisher_id
        WHERE c.status = 'INSUFFICIENT_FUNDS'
          AND w.balance_cents - w.reserved_cents >= c.cpc_cents_snapshot
          AND (c.end_at IS NULL OR c.end_at > ${now})
        LIMIT 500`;
  const changes: SoloStatusChange[] = [];
  for (const c of rows) {
    const res = await prisma.soloCampaign.updateMany({
      where: { id: c.id, status: "INSUFFICIENT_FUNDS" },
      data: { status: "ACTIVE", statusReason: null },
    });
    if (res.count) changes.push({ campaignId: c.id, publisherId: c.publisherId, name: c.name, from: "INSUFFICIENT_FUNDS", to: "ACTIVE" });
  }
  return changes;
}

/** Wallets with running campaigns whose spendable balance fell below the alert threshold. */
export async function findLowSoloWallets(thresholdCents: number) {
  if (thresholdCents <= 0) return [];
  return prisma.$queryRaw<Array<{ publisherId: string; availableCents: number }>>`
    SELECT w.publisher_id AS publisherId, CAST(w.balance_cents - w.reserved_cents AS SIGNED) AS availableCents
    FROM solo_wallets w
    WHERE w.balance_cents - w.reserved_cents < ${thresholdCents}
      AND EXISTS (SELECT 1 FROM solo_campaigns c WHERE c.publisher_id = w.publisher_id AND c.status = 'ACTIVE')
    LIMIT 1000`;
}
