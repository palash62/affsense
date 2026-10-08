import { prisma } from "@cpl/database";

export type SoloWalletMismatch = {
  walletId: string;
  publisherId: string;
  balanceCents: number;
  ledgerCents: number;
  reservedCents: number;
  pendingCents: number;
};

export type SoloCampaignMismatch = {
  campaignId: string;
  publisherId: string;
  spentCents: number;
  billedCents: number;
  reservedCents: number;
  pendingCents: number;
};

/**
 * Wallets whose cached balance differs from the ledger sum, or whose reserved
 * amount differs from the sum of their PENDING clicks. Read-only: the ledger is
 * the source of truth and mismatches are surfaced to admins, never auto-fixed.
 */
export async function findSoloWalletMismatches(limit = 100): Promise<SoloWalletMismatch[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT w.id AS walletId, w.publisher_id AS publisherId, w.balance_cents AS balanceCents,
           COALESCE(l.total, 0) AS ledgerCents, w.reserved_cents AS reservedCents,
           COALESCE(p.total, 0) AS pendingCents
    FROM solo_wallets w
    LEFT JOIN (SELECT wallet_id, SUM(amount_cents) AS total FROM solo_wallet_ledger GROUP BY wallet_id) l
      ON l.wallet_id = w.id
    LEFT JOIN (
      SELECT publisher_id, SUM(charge_cents) AS total FROM solo_clicks
      WHERE billing_status = 'PENDING' AND publisher_id IS NOT NULL GROUP BY publisher_id
    ) p ON p.publisher_id = w.publisher_id
    WHERE w.balance_cents <> COALESCE(l.total, 0) OR w.reserved_cents <> COALESCE(p.total, 0)
    LIMIT ${limit}`;
  return rows.map((r) => ({
    walletId: String(r.walletId),
    publisherId: String(r.publisherId),
    balanceCents: Number(r.balanceCents),
    ledgerCents: Number(r.ledgerCents),
    reservedCents: Number(r.reservedCents),
    pendingCents: Number(r.pendingCents),
  }));
}

/** Campaigns whose spent/reserved counters differ from their clicks. */
export async function findSoloCampaignMismatches(limit = 100): Promise<SoloCampaignMismatch[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT c.id AS campaignId, c.publisher_id AS publisherId, c.spent_cents AS spentCents,
           COALESCE(SUM(CASE WHEN k.billing_status = 'BILLED' THEN k.charge_cents ELSE 0 END), 0) AS billedCents,
           c.reserved_cents AS reservedCents,
           COALESCE(SUM(CASE WHEN k.billing_status = 'PENDING' THEN k.charge_cents ELSE 0 END), 0) AS pendingCents
    FROM solo_campaigns c
    LEFT JOIN solo_clicks k ON k.campaign_id = c.id
    GROUP BY c.id, c.publisher_id, c.spent_cents, c.reserved_cents
    HAVING c.spent_cents <> billedCents OR c.reserved_cents <> pendingCents
    LIMIT ${limit}`;
  return rows.map((r) => ({
    campaignId: String(r.campaignId),
    publisherId: String(r.publisherId),
    spentCents: Number(r.spentCents),
    billedCents: Number(r.billedCents),
    reservedCents: Number(r.reservedCents),
    pendingCents: Number(r.pendingCents),
  }));
}
