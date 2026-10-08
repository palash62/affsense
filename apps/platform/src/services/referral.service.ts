import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { PENDING_PAYOUT_STATUSES } from "@/lib/payout-status";
import {
  generateReferralCode,
  PUBLISHER_REFERRAL_RATES,
  PUBLISHER_REFERRAL_REFERENCES,
  PUBLISHER_REFERRAL_START_AT,
  REFERRAL_CPA_REFERENCE,
  REFERRAL_LEVEL_1_RATE,
  REFERRAL_LEVEL_2_RATE,
} from "@/lib/referral";
import {
  planPublisherReferralEntries,
  referralEntryKey,
  signedReferralAmount,
  type ReferralDigitalSource,
} from "@/lib/publisher-referral";
import { getLeadCpl } from "@/lib/lead-cpl";
import {
  creditWallet,
  DIGITAL_PRODUCT_REFUND_REFERENCE,
  DIGITAL_PRODUCT_REJECT_REFERENCE,
  DIGITAL_PRODUCT_SALE_REFERENCE,
  ensurePublisherWallet,
  forceDebitWallet,
} from "@/services/wallet.service";

type ReferralUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  level: 1 | 2;
  adSpend: number;
  commission: number;
  referredByName?: string;
};

type ReferralCreditResult = {
  referrerId: string;
  level: 1 | 2;
  amount: number;
};

type ReferralCommissionEntry = {
  id: string;
  amount: number;
  description: string | null;
  createdAt: Date;
  referenceId: string | null;
};

export type ReferralBalanceSummary = {
  referralEarned: number;
  referralPaidOut: number;
  pendingReferralPayout: number;
  withdrawableReferral: number;
  availableBalance: number;
};

async function createUniqueReferralCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const referralCode = generateReferralCode();
    const existing = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (!existing) return referralCode;
  }

  return generateReferralCode(8);
}

export async function ensureReferralCode(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (user?.referralCode) return user.referralCode;

  const referralCode = await createUniqueReferralCode();
  const updated = await prisma.user.updateMany({
    where: { id: userId },
    data: { referralCode },
  });

  if (updated.count === 0) {
    return referralCode;
  }

  return referralCode;
}

export async function resolveReferrerId(referralRef?: string | null) {
  if (!referralRef?.trim()) return null;

  const ref = referralRef.trim();
  const byCode = await prisma.user.findUnique({
    where: { referralCode: ref.toUpperCase() },
    select: { id: true, role: true },
  });
  if (byCode) {
    return byCode.role === "ADVERTISER" ? byCode.id : null;
  }

  const byId = await prisma.user.findUnique({
    where: { id: ref },
    select: { id: true, role: true },
  });

  return byId?.role === "ADVERTISER" ? byId.id : null;
}

async function ensureAdvertiserWallet(userId: string, tx: Prisma.TransactionClient) {
  return tx.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function creditReferralIfNotExists(
  tx: Prisma.TransactionClient,
  referrerId: string,
  leadId: string,
  amount: number,
  level: 1 | 2,
): Promise<boolean> {
  const existing = await tx.ledgerEntry.findFirst({
    where: {
      type: "CREDIT",
      referenceType: "referral",
      referenceId: leadId,
      wallet: { userId: referrerId },
    },
    select: { id: true },
  });

  if (existing || amount <= 0) return false;

  await ensureAdvertiserWallet(referrerId, tx);
  await creditWallet(
    tx,
    referrerId,
    amount,
    "referral",
    leadId,
    `Level ${level} referral commission`,
  );

  return true;
}

export async function creditReferralCommissionsForLead(
  tx: Prisma.TransactionClient,
  leadId: string,
  advertiserId: string,
  cpl: number,
): Promise<ReferralCreditResult[]> {
  const advertiser = await tx.user.findUnique({
    where: { id: advertiserId },
    select: {
      referredBy: {
        select: {
          id: true,
          role: true,
          referredBy: { select: { id: true, role: true } },
        },
      },
    },
  });

  if (!advertiser) return [];

  const credited: ReferralCreditResult[] = [];
  const level1 = advertiser.referredBy;

  if (level1?.role === "ADVERTISER") {
    const amount = cpl * REFERRAL_LEVEL_1_RATE;
    const didCredit = await creditReferralIfNotExists(tx, level1.id, leadId, amount, 1);
    if (didCredit) {
      credited.push({ referrerId: level1.id, level: 1, amount });
    }
  }

  const level2 = level1?.referredBy;
  if (level2?.role === "ADVERTISER") {
    const amount = cpl * REFERRAL_LEVEL_2_RATE;
    const didCredit = await creditReferralIfNotExists(tx, level2.id, leadId, amount, 2);
    if (didCredit) {
      credited.push({ referrerId: level2.id, level: 2, amount });
    }
  }

  return credited;
}

export async function reconcileReferralCreditsForLead(leadId: string): Promise<boolean> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        campaign: { select: { advertiserId: true, cpl: true } },
      },
    });

    if (!lead || lead.status !== "PAID") return false;

    const cpl = getLeadCpl(lead);
    let credited = false;

    await prisma.$transaction(async (tx) => {
      const results = await creditReferralCommissionsForLead(
        tx,
        leadId,
        lead.campaign.advertiserId,
        cpl,
      );
      credited = results.length > 0;
    });

    return credited;
  } catch (error) {
    console.error(`Failed to reconcile referral credit for lead ${leadId}`, error);
    return false;
  }
}

export async function reconcileAllReferralCredits(): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { status: "PAID" },
    select: { id: true },
  });

  let credited = 0;
  for (const lead of leads) {
    const didCredit = await reconcileReferralCreditsForLead(lead.id);
    if (didCredit) credited += 1;
  }

  return credited;
}

export async function reconcileReferralCreditsForUser(userId: string): Promise<number> {
  const level1Users = await prisma.user.findMany({
    where: { referredById: userId },
    select: {
      id: true,
      referrals: { select: { id: true } },
    },
  });

  const spenderIds = [
    ...level1Users.map((user) => user.id),
    ...level1Users.flatMap((user) => user.referrals.map((referral) => referral.id)),
  ];

  if (spenderIds.length === 0) return 0;

  const leads = await prisma.lead.findMany({
    where: {
      status: "PAID",
      campaign: { advertiserId: { in: spenderIds } },
    },
    select: { id: true },
  });

  let credited = 0;
  for (const lead of leads) {
    const didCredit = await reconcileReferralCreditsForLead(lead.id);
    if (didCredit) credited += 1;
  }

  return credited;
}

export async function getReferralBalanceSummary(userId: string): Promise<ReferralBalanceSummary> {
  const [credits, debits, pendingPayouts, wallet] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        type: "CREDIT",
        referenceType: "referral",
        wallet: { userId },
      },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        type: "DEBIT",
        referenceType: "referral_payout",
        wallet: { userId },
      },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: {
        publisherId: userId,
        kind: "REFERRAL",
        status: { in: [...PENDING_PAYOUT_STATUSES] },
      },
      _sum: { amount: true },
    }),
    prisma.wallet.findUnique({ where: { userId } }),
  ]);

  const referralEarned = Number(credits._sum.amount ?? 0);
  const referralPaidOut = Number(debits._sum.amount ?? 0);
  const pendingReferralPayout = Number(pendingPayouts._sum.amount ?? 0);
  const withdrawableReferral = Math.max(
    0,
    referralEarned - referralPaidOut - pendingReferralPayout,
  );
  const availableBalance = wallet
    ? Number(wallet.balance) - Number(wallet.holdBalance)
    : 0;

  return {
    referralEarned,
    referralPaidOut,
    pendingReferralPayout,
    withdrawableReferral,
    availableBalance,
  };
}

async function getPaidLeadTotalsByAdvertiser(advertiserIds: string[]) {
  if (advertiserIds.length === 0) return new Map<string, { adSpend: number; leadIds: string[] }>();

  const leads = await prisma.lead.findMany({
    where: {
      status: "PAID",
      campaign: { advertiserId: { in: advertiserIds } },
    },
    select: {
      id: true,
      cpl: true,
      campaign: { select: { advertiserId: true, cpl: true } },
    },
  });

  const totals = new Map<string, { adSpend: number; leadIds: string[] }>();
  for (const lead of leads) {
    const advertiserId = lead.campaign.advertiserId;
    const current = totals.get(advertiserId) ?? { adSpend: 0, leadIds: [] };
    current.adSpend += getLeadCpl(lead);
    current.leadIds.push(lead.id);
    totals.set(advertiserId, current);
  }

  return totals;
}

async function getReferralCommissionsForLeads(referrerId: string, leadIds: string[]) {
  if (leadIds.length === 0) return 0;

  const result = await prisma.ledgerEntry.aggregate({
    where: {
      type: "CREDIT",
      referenceType: "referral",
      referenceId: { in: leadIds },
      wallet: { userId: referrerId },
    },
    _sum: { amount: true },
  });

  return Number(result._sum.amount ?? 0);
}

async function listRecentReferralCommissions(
  referrerId: string,
  limit = 10,
): Promise<(ReferralCommissionEntry & { spenderName?: string })[]> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      type: "CREDIT",
      referenceType: "referral",
      wallet: { userId: referrerId },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      description: true,
      createdAt: true,
      referenceId: true,
    },
  });

  const leadIds = entries
    .map((entry) => entry.referenceId)
    .filter((id): id is string => Boolean(id));

  const leads =
    leadIds.length > 0
      ? await prisma.lead.findMany({
          where: { id: { in: leadIds } },
          select: {
            id: true,
            campaign: {
              select: {
                advertiser: { select: { name: true } },
              },
            },
          },
        })
      : [];

  const spenderByLeadId = new Map(
    leads.map((lead) => [lead.id, lead.campaign.advertiser.name] as const),
  );

  return entries.map((entry) => {
    const spenderName = entry.referenceId
      ? spenderByLeadId.get(entry.referenceId)
      : undefined;
    const baseDescription = entry.description ?? "Referral commission";
    const description =
      spenderName && !baseDescription.includes(spenderName)
        ? `${baseDescription} from ${spenderName}`
        : baseDescription;

    return {
      id: entry.id,
      amount: Number(entry.amount),
      description,
      createdAt: entry.createdAt,
      referenceId: entry.referenceId,
      spenderName,
    };
  });
}

export type AdminReferralReportRow = {
  referredId: string;
  referredName: string;
  referredEmail: string;
  referredStatus: string;
  joinedAt: Date;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referrerCode: string | null;
  adSpend: number;
  commission: number;
};

export async function getAdminReferralReport(options?: { q?: string }) {
  const q = options?.q?.trim();

  const [referredUsers, globalReferred, totalCommissionAgg, pendingPayoutAgg] = await Promise.all([
    prisma.user.findMany({
      where: {
        referredById: { not: null },
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { referredBy: { name: { contains: q } } },
                { referredBy: { email: { contains: q } } },
                { referredBy: { referralCode: { contains: q.toUpperCase() } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        referredBy: {
          select: {
            id: true,
            name: true,
            email: true,
            referralCode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { referredById: { not: null } },
      select: { referredById: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        type: "CREDIT",
        referenceType: "referral",
      },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: {
        kind: "REFERRAL",
        status: { in: [...PENDING_PAYOUT_STATUSES] },
      },
      _sum: { amount: true },
    }),
  ]);

  const referredIds = referredUsers.map((user) => user.id);
  const spendTotals = await getPaidLeadTotalsByAdvertiser(referredIds);

  const rows: AdminReferralReportRow[] = await Promise.all(
    referredUsers.map(async (user) => {
      const referrer = user.referredBy!;
      const totals = spendTotals.get(user.id) ?? { adSpend: 0, leadIds: [] };
      const commission = await getReferralCommissionsForLeads(referrer.id, totals.leadIds);

      return {
        referredId: user.id,
        referredName: user.name,
        referredEmail: user.email,
        referredStatus: user.status,
        joinedAt: user.createdAt,
        referrerId: referrer.id,
        referrerName: referrer.name,
        referrerEmail: referrer.email,
        referrerCode: referrer.referralCode,
        adSpend: totals.adSpend,
        commission,
      };
    }),
  );

  const activeReferrers = new Set(
    globalReferred.map((user) => user.referredById).filter((id): id is string => Boolean(id)),
  ).size;

  return {
    stats: {
      activeReferrers,
      totalReferred: globalReferred.length,
      totalCommission: Number(totalCommissionAgg._sum.amount ?? 0),
      pendingReferralPayout: Number(pendingPayoutAgg._sum.amount ?? 0),
      filteredCommission: rows.reduce((sum, row) => sum + row.commission, 0),
      filteredAdSpend: rows.reduce((sum, row) => sum + row.adSpend, 0),
    },
    rows,
  };
}

const referralUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

export async function getAdvertiserReferralData(userId: string) {
  await reconcileReferralCreditsForUser(userId);

  const referralCode = await ensureReferralCode(userId);

  const level1Users = await prisma.user.findMany({
    where: { referredById: userId },
    select: {
      ...referralUserSelect,
      referrals: {
        select: {
          ...referralUserSelect,
          referredBy: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const allSpenderIds = [
    ...level1Users.map((user) => user.id),
    ...level1Users.flatMap((user) => user.referrals.map((referral) => referral.id)),
  ];
  const spendTotals = await getPaidLeadTotalsByAdvertiser(allSpenderIds);

  const level1Rows: ReferralUserRow[] = await Promise.all(
    level1Users.map(async (user) => {
      const totals = spendTotals.get(user.id) ?? { adSpend: 0, leadIds: [] };
      const commission = await getReferralCommissionsForLeads(userId, totals.leadIds);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        level: 1 as const,
        adSpend: totals.adSpend,
        commission,
      };
    }),
  );

  const level2Rows: ReferralUserRow[] = await Promise.all(
    level1Users.flatMap((user) =>
      user.referrals.map(async (referral) => {
        const totals = spendTotals.get(referral.id) ?? { adSpend: 0, leadIds: [] };
        const commission = await getReferralCommissionsForLeads(userId, totals.leadIds);

        return {
          id: referral.id,
          name: referral.name,
          email: referral.email,
          role: referral.role,
          status: referral.status,
          createdAt: referral.createdAt,
          level: 2 as const,
          adSpend: totals.adSpend,
          commission,
          referredByName: user.name,
        };
      }),
    ),
  );

  const rows = [...level1Rows, ...level2Rows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const level1Commission = level1Rows.reduce((sum, row) => sum + row.commission, 0);
  const level2Commission = level2Rows.reduce((sum, row) => sum + row.commission, 0);
  const balance = await getReferralBalanceSummary(userId);
  const commissionHistory = await listRecentReferralCommissions(userId);

  return {
    referralCode,
    stats: {
      totalReferrals: rows.length,
      level1Count: level1Rows.length,
      level2Count: level2Rows.length,
      level1Commission,
      level2Commission,
      totalCommission: level1Commission + level2Commission,
      ...balance,
    },
    referrals: rows,
    commissionHistory,
  };
}

const DIGITAL_SOURCE_REFERENCES = [
  DIGITAL_PRODUCT_SALE_REFERENCE,
  DIGITAL_PRODUCT_REFUND_REFERENCE,
  DIGITAL_PRODUCT_REJECT_REFERENCE,
];

function webhookSaleKey(event: {
  publisherId: string | null;
  digitalProductId: string | null;
  cfOrderId: string | null;
  cfProductId: string | null;
}) {
  if (!event.publisherId || !event.digitalProductId || !event.cfOrderId) return null;
  return [event.publisherId, event.digitalProductId, event.cfOrderId, event.cfProductId ?? ""].join("|");
}

/**
 * Credit publisher referrers 10% of their referred affiliates' Digital Product
 * commission and 5% of their CPA payout. Safe to run repeatedly.
 */
export async function reconcilePublisherReferralCommissions(referrerId?: string): Promise<number> {
  try {
    const referred = await prisma.user.findMany({
      where: {
        role: "PUBLISHER",
        referredBy: referrerId ? { id: referrerId, role: "PUBLISHER" } : { role: "PUBLISHER" },
      },
      select: { id: true, name: true, referredById: true },
    });
    if (referred.length === 0) return 0;

    const referrerOf = new Map(referred.map((user) => [user.id, user.referredById!]));
    const nameOf = new Map(referred.map((user) => [user.id, user.name]));
    const referredIds = referred.map((user) => user.id);
    const since = { gte: PUBLISHER_REFERRAL_START_AT };

    const [digitalEntries, conversions] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: {
          referenceType: { in: DIGITAL_SOURCE_REFERENCES },
          createdAt: since,
          wallet: { userId: { in: referredIds } },
        },
        select: {
          amount: true,
          referenceType: true,
          referenceId: true,
          createdAt: true,
          wallet: { select: { userId: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.cpaOfferConversion.findMany({
        where: {
          createdAt: since,
          payout: { gt: 0 },
          clickRecord: { publisherId: { in: referredIds } },
        },
        select: {
          id: true,
          payout: true,
          createdAt: true,
          offer: { select: { name: true } },
          clickRecord: { select: { publisherId: true } },
        },
      }),
    ]);

    const eventIds = [
      ...new Set(
        digitalEntries
          .map((entry) => entry.referenceId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const events =
      eventIds.length > 0
        ? await prisma.webhookEvent.findMany({
            where: { id: { in: eventIds } },
            select: {
              id: true,
              publisherId: true,
              digitalProductId: true,
              cfOrderId: true,
              cfProductId: true,
            },
          })
        : [];
    const eventById = new Map(events.map((event) => [event.id, event]));
    const saleEventByKey = new Map<string, string>();
    for (const entry of digitalEntries) {
      if (entry.referenceType !== DIGITAL_PRODUCT_SALE_REFERENCE || !entry.referenceId) continue;
      const event = eventById.get(entry.referenceId);
      const key = event ? webhookSaleKey(event) : null;
      if (key && !saleEventByKey.has(key)) saleEventByKey.set(key, entry.referenceId);
    }

    const digital = digitalEntries.flatMap((entry): ReferralDigitalSource[] => {
      if (!entry.referenceId) return [];
      const base = {
        publisherId: entry.wallet.userId,
        amount: Number(entry.amount),
        createdAt: entry.createdAt,
      };
      if (entry.referenceType === DIGITAL_PRODUCT_SALE_REFERENCE) {
        return [{ ...base, kind: "sale" as const, saleEventId: entry.referenceId }];
      }
      if (entry.referenceType === DIGITAL_PRODUCT_REJECT_REFERENCE) {
        return [{ ...base, kind: "reversal" as const, saleEventId: entry.referenceId }];
      }
      const event = eventById.get(entry.referenceId);
      const key = event ? webhookSaleKey(event) : null;
      return [
        { ...base, kind: "reversal" as const, saleEventId: key ? saleEventByKey.get(key) ?? null : null },
      ];
    });

    const cpa = conversions.flatMap((conversion) =>
      conversion.clickRecord?.publisherId
        ? [
            {
              publisherId: conversion.clickRecord.publisherId,
              conversionId: conversion.id,
              payout: Number(conversion.payout ?? 0),
              createdAt: conversion.createdAt,
              offerName: conversion.offer.name,
            },
          ]
        : [],
    );

    const referenceIds = [
      ...new Set([
        ...digital.map((source) => source.saleEventId).filter((id): id is string => Boolean(id)),
        ...cpa.map((source) => source.conversionId),
      ]),
    ];
    if (referenceIds.length === 0) return 0;

    const existingEntries = await prisma.ledgerEntry.findMany({
      where: {
        referenceType: { in: PUBLISHER_REFERRAL_REFERENCES },
        referenceId: { in: referenceIds },
      },
      select: { referenceType: true, referenceId: true, amount: true },
    });
    const existing = new Map(
      existingEntries.map((entry) => [
        referralEntryKey(entry.referenceType, entry.referenceId ?? ""),
        Number(entry.amount),
      ]),
    );

    const planned = planPublisherReferralEntries({ referrerOf, nameOf, digital, cpa, existing });
    if (planned.length === 0) return 0;

    const byReferrer = new Map<string, typeof planned>();
    for (const entry of planned) {
      const list = byReferrer.get(entry.referrerId) ?? [];
      list.push(entry);
      byReferrer.set(entry.referrerId, list);
    }

    let posted = 0;
    for (const [walletUserId, entries] of byReferrer) {
      await ensurePublisherWallet(walletUserId);
      posted += await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM wallets WHERE user_id = ${walletUserId} FOR UPDATE`;
        const already = await tx.ledgerEntry.findMany({
          where: {
            referenceType: { in: PUBLISHER_REFERRAL_REFERENCES },
            referenceId: { in: entries.map((entry) => entry.referenceId) },
          },
          select: { referenceType: true, referenceId: true },
        });
        const alreadyKeys = new Set(
          already.map((entry) => referralEntryKey(entry.referenceType, entry.referenceId ?? "")),
        );

        let count = 0;
        for (const entry of entries) {
          if (alreadyKeys.has(referralEntryKey(entry.referenceType, entry.referenceId))) continue;
          if (entry.type === "CREDIT") {
            await creditWallet(
              tx,
              walletUserId,
              entry.amount,
              entry.referenceType,
              entry.referenceId,
              entry.description,
            );
          } else {
            await forceDebitWallet(
              tx,
              walletUserId,
              entry.amount,
              entry.referenceType,
              entry.referenceId,
              entry.description,
            );
          }
          count += 1;
        }
        return count;
      });
    }
    return posted;
  } catch (error) {
    console.error("Failed to reconcile publisher referral commissions", error);
    return 0;
  }
}

export async function getPublisherReferralEarnings(userId: string) {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      referenceType: { in: PUBLISHER_REFERRAL_REFERENCES },
      wallet: { userId },
    },
    select: { type: true, amount: true, invoiceId: true },
  });
  let total = 0;
  let uninvoiced = 0;
  for (const entry of entries) {
    const signed = signedReferralAmount({ type: entry.type, amount: Number(entry.amount) });
    total += signed;
    if (!entry.invoiceId) uninvoiced += signed;
  }
  return { total: round2(total), uninvoiced: round2(uninvoiced) };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type PublisherReferralMonth = { month: string; digital: number; cpa: number };

export async function getPublisherReferralData(userId: string) {
  await reconcilePublisherReferralCommissions(userId);

  const [referralCode, referredUsers, entries] = await Promise.all([
    ensureReferralCode(userId),
    prisma.user.findMany({
      where: { referredById: userId, role: "PUBLISHER" },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        referenceType: { in: PUBLISHER_REFERRAL_REFERENCES },
        wallet: { userId },
      },
      select: {
        id: true,
        type: true,
        amount: true,
        referenceType: true,
        referenceId: true,
        description: true,
        createdAt: true,
        invoiceId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const referredIds = referredUsers.map((user) => user.id);
  const since = { gte: PUBLISHER_REFERRAL_START_AT };
  const [digitalEntries, conversions] = referredIds.length
    ? await Promise.all([
        prisma.ledgerEntry.findMany({
          where: {
            referenceType: { in: DIGITAL_SOURCE_REFERENCES },
            createdAt: since,
            wallet: { userId: { in: referredIds } },
          },
          select: {
            type: true,
            amount: true,
            referenceType: true,
            referenceId: true,
            wallet: { select: { userId: true } },
          },
        }),
        prisma.cpaOfferConversion.findMany({
          where: { createdAt: since, clickRecord: { publisherId: { in: referredIds } } },
          select: { id: true, payout: true, clickRecord: { select: { publisherId: true } } },
        }),
      ])
    : [[], []];

  const totalsByUser = new Map<
    string,
    { digitalCommission: number; cpaPayout: number; conversions: number; yourCommission: number }
  >();
  const totalsFor = (id: string) => {
    let totals = totalsByUser.get(id);
    if (!totals) {
      totals = { digitalCommission: 0, cpaPayout: 0, conversions: 0, yourCommission: 0 };
      totalsByUser.set(id, totals);
    }
    return totals;
  };

  const saleByEventId = new Map<string, { userId: string; amount: number }>();
  for (const entry of digitalEntries) {
    const userIdOfEntry = entry.wallet.userId;
    const signed = entry.type === "DEBIT" ? -Number(entry.amount) : Number(entry.amount);
    const totals = totalsFor(userIdOfEntry);
    totals.digitalCommission += signed;
    if (entry.referenceType === DIGITAL_PRODUCT_SALE_REFERENCE && entry.referenceId) {
      totals.conversions += 1;
      saleByEventId.set(entry.referenceId, { userId: userIdOfEntry, amount: Number(entry.amount) });
    }
  }

  const conversionById = new Map<string, { userId: string; payout: number }>();
  for (const conversion of conversions) {
    const publisherId = conversion.clickRecord?.publisherId;
    if (!publisherId) continue;
    const payout = Number(conversion.payout ?? 0);
    const totals = totalsFor(publisherId);
    totals.cpaPayout += payout;
    totals.conversions += 1;
    conversionById.set(conversion.id, { userId: publisherId, payout });
  }

  const nameById = new Map(referredUsers.map((user) => [user.id, user.name]));
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const months: PublisherReferralMonth[] = [];
  const monthIndex = new Map<string, number>();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    monthIndex.set(monthKey(date), months.length);
    months.push({
      month: `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
      digital: 0,
      cpa: 0,
    });
  }

  const stats = {
    totalReferrals: referredUsers.length,
    activeReferrals: referredUsers.filter((user) => user.status === "ACTIVE").length,
    totalEarned: 0,
    digitalEarned: 0,
    cpaEarned: 0,
    thisMonth: 0,
    uninvoiced: 0,
    invoiced: 0,
  };

  const history = entries.map((entry) => {
    const amount = signedReferralAmount({ type: entry.type, amount: Number(entry.amount) });
    const source = entry.referenceType === REFERRAL_CPA_REFERENCE ? ("cpa" as const) : ("digital" as const);
    const attribution =
      source === "cpa"
        ? conversionById.get(entry.referenceId ?? "")
        : saleByEventId.get(entry.referenceId ?? "");
    const base =
      attribution && "payout" in attribution ? attribution.payout : attribution?.amount ?? null;

    stats.totalEarned += amount;
    if (source === "cpa") stats.cpaEarned += amount;
    else stats.digitalEarned += amount;
    if (entry.createdAt >= monthStart) stats.thisMonth += amount;
    if (entry.invoiceId) stats.invoiced += amount;
    else stats.uninvoiced += amount;

    const index = monthIndex.get(monthKey(entry.createdAt));
    if (index !== undefined) months[index][source] = round2(months[index][source] + amount);

    if (attribution) totalsFor(attribution.userId).yourCommission += amount;

    return {
      id: entry.id,
      createdAt: entry.createdAt,
      source,
      isReversal: entry.type === "DEBIT",
      affiliateName: attribution ? nameById.get(attribution.userId) ?? "Referred affiliate" : "Referred affiliate",
      base,
      rate: PUBLISHER_REFERRAL_RATES[source],
      amount,
      invoiced: Boolean(entry.invoiceId),
      description: entry.description,
    };
  });

  for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
    if (key !== "totalReferrals" && key !== "activeReferrals") stats[key] = round2(stats[key]);
  }

  const referrals = referredUsers.map((user) => {
    const totals = totalsByUser.get(user.id);
    return {
      ...user,
      digitalCommission: round2(totals?.digitalCommission ?? 0),
      cpaPayout: round2(totals?.cpaPayout ?? 0),
      conversions: totals?.conversions ?? 0,
      yourCommission: round2(totals?.yourCommission ?? 0),
    };
  });

  return {
    referralCode,
    stats,
    referrals,
    history: history.slice(0, 50),
    months,
  };
}
