import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { prisma } from "@/lib/prisma";

export type AdminProfitSnapshot = {
  advertiserPayment: number;
  publisherPayout: number;
  referralPay: number;
  /** Platform profit (advertiser − publisher − referral). Kept as adminProfit for existing callers. */
  adminProfit: number;
};

export type ProfitGroupBy = "day" | "month" | "year";
export type ProfitPeriod = "today" | "month" | "year" | "custom";

export const ADMIN_PROFIT_SHARE = 0.8;
export const PARTNER_PROFIT_SHARE = 0.2;

export type PlatformProfitSplit = {
  platformProfit: number;
  adminProfit: number;
  partnerProfit: number;
};

export type ProfitBreakdownRow = {
  period: string;
  advertiserPayment: number;
  publisherPayout: number;
  referralPay: number;
  platformProfit: number;
  adminProfit: number;
  partnerProfit: number;
};

export type AdminProfitPageData = {
  from: Date;
  to: Date;
  groupBy: ProfitGroupBy;
  summary: {
    advertiserPayment: number;
    publisherPayout: number;
    referralPay: number;
    platformProfit: number;
    adminProfit: number;
    partnerProfit: number;
  };
  rows: ProfitBreakdownRow[];
};

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function splitPlatformProfit(platformProfit: number): PlatformProfitSplit {
  const platform = roundMoney(platformProfit);
  const adminProfit = roundMoney(platform * ADMIN_PROFIT_SHARE);
  const partnerProfit = roundMoney(platform - adminProfit);
  return {
    platformProfit: platform,
    adminProfit,
    partnerProfit,
  };
}

function dateFormatPattern(groupBy: ProfitGroupBy) {
  switch (groupBy) {
    case "month":
      return "%Y-%m";
    case "year":
      return "%Y";
    default:
      return "%Y-%m-%d";
  }
}

function bucketLabelFormat(groupBy: ProfitGroupBy) {
  switch (groupBy) {
    case "month":
      return "yyyy-MM";
    case "year":
      return "yyyy";
    default:
      return "yyyy-MM-dd";
  }
}

export function generateProfitBuckets(from: Date, to: Date, groupBy: ProfitGroupBy): string[] {
  const fmt = bucketLabelFormat(groupBy);
  if (groupBy === "year") {
    return eachYearOfInterval({ start: from, end: to }).map((d) => format(d, fmt));
  }
  if (groupBy === "month") {
    return eachMonthOfInterval({ start: from, end: to }).map((d) => format(d, fmt));
  }
  return eachDayOfInterval({ start: from, end: to }).map((d) => format(d, fmt));
}

/** Display label for an ISO bucket key (keeps SQL merge keys unchanged). */
export function formatProfitPeriodLabel(period: string, groupBy: ProfitGroupBy): string {
  if (groupBy === "year") return period;
  if (groupBy === "month") {
    const [y, m] = period.split("-");
    if (y && m) return `${m}-${y}`;
    return period;
  }
  // day: yyyy-MM-dd → dd-mm-yyyy
  const [y, m, d] = period.split("-");
  if (y && m && d) return `${d}-${m}-${y}`;
  return period;
}

/** Format an ISO date string (yyyy-MM-dd) as dd-mm-yyyy for UI/CSV subtitles. */
export function formatProfitDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (y && m && d) return `${d}-${m}-${y}`;
  return isoDate;
}

export const PROFIT_TABLE_PAGE_SIZE = 20;

export function resolveProfitPageRange(params: {
  period?: string;
  from?: string;
  to?: string;
  group?: string;
}): {
  period: ProfitPeriod;
  from: Date;
  to: Date;
  fromStr: string;
  toStr: string;
  groupBy: ProfitGroupBy;
} {
  const now = new Date();
  let period: ProfitPeriod =
    params.period === "today" ||
    params.period === "month" ||
    params.period === "year" ||
    params.period === "custom"
      ? params.period
      : params.from || params.to
        ? "custom"
        : "month";

  let from: Date;
  let to: Date;

  if (period === "today") {
    from = startOfDay(now);
    to = endOfDay(now);
  } else if (period === "year") {
    from = startOfYear(now);
    to = endOfDay(now);
  } else if (period === "month") {
    from = startOfMonth(now);
    to = endOfDay(now);
  } else {
    const fromStr = params.from ?? format(startOfMonth(now), "yyyy-MM-dd");
    const toStr = params.to ?? format(now, "yyyy-MM-dd");
    from = startOfDay(parseISO(fromStr));
    to = endOfDay(parseISO(toStr));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      from = startOfMonth(now);
      to = endOfDay(now);
      period = "month";
    }
  }

  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");

  const groupBy: ProfitGroupBy =
    params.group === "day" || params.group === "month" || params.group === "year"
      ? params.group
      : period === "year"
        ? "month"
        : "day";

  return { period, from, to, fromStr, toStr, groupBy };
}

/**
 * Advertiser payments for PAID leads using snapshotted lead.cpl (fallback campaign.cpl),
 * dated by the advertiser lead DEBIT ledger row (payment time) — not leads.updated_at / live campaign.cpl.
 */
async function getAdvertiserPaymentsForRange(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ total: unknown }[]>`
    SELECT COALESCE(SUM(COALESCE(l.cpl, c.cpl)), 0) AS total
    FROM leads l
    INNER JOIN campaigns c ON c.id = l.campaign_id
    INNER JOIN ledger_entries le
      ON le.reference_id = l.id
     AND le.reference_type = 'lead'
     AND le.type = 'DEBIT'
    INNER JOIN wallets w ON w.id = le.wallet_id
    INNER JOIN users u ON u.id = w.user_id AND u.role = 'ADVERTISER'
    WHERE l.status = 'PAID'
      AND le.created_at >= ${from}
      AND le.created_at <= ${to}
  `;

  return Number(rows[0]?.total ?? 0);
}

/** Publisher lead earnings net of lead_reversal clawbacks (not withdrawals). */
async function getPublisherPayoutsForRange(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ total: unknown }[]>`
    SELECT COALESCE(SUM(
      CASE
        WHEN le.type = 'CREDIT' AND le.reference_type = 'lead' THEN le.amount
        WHEN le.type = 'DEBIT' AND le.reference_type = 'lead_reversal'
          AND EXISTS (
            SELECT 1 FROM ledger_entries orig
            WHERE orig.wallet_id = le.wallet_id
              AND orig.reference_id = le.reference_id
              AND orig.reference_type = 'lead'
              AND orig.type = 'CREDIT'
          )
        THEN -le.amount
        ELSE 0
      END
    ), 0) AS total
    FROM ledger_entries le
    INNER JOIN wallets w ON w.id = le.wallet_id
    INNER JOIN users u ON u.id = w.user_id
    WHERE u.role = 'PUBLISHER'
      AND (
        (le.type = 'CREDIT' AND le.reference_type = 'lead')
        OR (le.type = 'DEBIT' AND le.reference_type = 'lead_reversal')
      )
      AND le.created_at >= ${from}
      AND le.created_at <= ${to}
  `;

  return Number(rows[0]?.total ?? 0);
}

/** Referral commissions net of lead_reversal clawbacks. */
async function getReferralPayForRange(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ total: unknown }[]>`
    SELECT COALESCE(SUM(
      CASE
        WHEN le.type = 'CREDIT' AND le.reference_type = 'referral' THEN le.amount
        WHEN le.type = 'DEBIT' AND le.reference_type = 'lead_reversal'
          AND EXISTS (
            SELECT 1 FROM ledger_entries orig
            WHERE orig.wallet_id = le.wallet_id
              AND orig.reference_id = le.reference_id
              AND orig.reference_type = 'referral'
              AND orig.type = 'CREDIT'
          )
        THEN -le.amount
        ELSE 0
      END
    ), 0) AS total
    FROM ledger_entries le
    WHERE (
        (le.type = 'CREDIT' AND le.reference_type = 'referral')
        OR (le.type = 'DEBIT' AND le.reference_type = 'lead_reversal')
      )
      AND le.created_at >= ${from}
      AND le.created_at <= ${to}
  `;

  return Number(rows[0]?.total ?? 0);
}

async function getGroupedTotals(
  from: Date,
  to: Date,
  groupBy: ProfitGroupBy,
): Promise<{
  advertiser: Map<string, number>;
  publisher: Map<string, number>;
  referral: Map<string, number>;
}> {
  const pattern = dateFormatPattern(groupBy);

  const [advertiserRows, publisherRows, referralRows] = await Promise.all([
    prisma.$queryRaw<{ bucket: string; total: unknown }[]>`
      SELECT DATE_FORMAT(le.created_at, ${pattern}) AS bucket,
             COALESCE(SUM(COALESCE(l.cpl, c.cpl)), 0) AS total
      FROM leads l
      INNER JOIN campaigns c ON c.id = l.campaign_id
      INNER JOIN ledger_entries le
        ON le.reference_id = l.id
       AND le.reference_type = 'lead'
       AND le.type = 'DEBIT'
      INNER JOIN wallets w ON w.id = le.wallet_id
      INNER JOIN users u ON u.id = w.user_id AND u.role = 'ADVERTISER'
      WHERE l.status = 'PAID'
        AND le.created_at >= ${from}
        AND le.created_at <= ${to}
      GROUP BY bucket
      ORDER BY bucket
    `,
    prisma.$queryRaw<{ bucket: string; total: unknown }[]>`
      SELECT DATE_FORMAT(le.created_at, ${pattern}) AS bucket,
             COALESCE(SUM(
               CASE
                 WHEN le.type = 'CREDIT' AND le.reference_type = 'lead' THEN le.amount
                 WHEN le.type = 'DEBIT' AND le.reference_type = 'lead_reversal'
                   AND EXISTS (
                     SELECT 1 FROM ledger_entries orig
                     WHERE orig.wallet_id = le.wallet_id
                       AND orig.reference_id = le.reference_id
                       AND orig.reference_type = 'lead'
                       AND orig.type = 'CREDIT'
                   )
                 THEN -le.amount
                 ELSE 0
               END
             ), 0) AS total
      FROM ledger_entries le
      INNER JOIN wallets w ON w.id = le.wallet_id
      INNER JOIN users u ON u.id = w.user_id
      WHERE u.role = 'PUBLISHER'
        AND (
          (le.type = 'CREDIT' AND le.reference_type = 'lead')
          OR (le.type = 'DEBIT' AND le.reference_type = 'lead_reversal')
        )
        AND le.created_at >= ${from}
        AND le.created_at <= ${to}
      GROUP BY bucket
      ORDER BY bucket
    `,
    prisma.$queryRaw<{ bucket: string; total: unknown }[]>`
      SELECT DATE_FORMAT(le.created_at, ${pattern}) AS bucket,
             COALESCE(SUM(
               CASE
                 WHEN le.type = 'CREDIT' AND le.reference_type = 'referral' THEN le.amount
                 WHEN le.type = 'DEBIT' AND le.reference_type = 'lead_reversal'
                   AND EXISTS (
                     SELECT 1 FROM ledger_entries orig
                     WHERE orig.wallet_id = le.wallet_id
                       AND orig.reference_id = le.reference_id
                       AND orig.reference_type = 'referral'
                       AND orig.type = 'CREDIT'
                   )
                 THEN -le.amount
                 ELSE 0
               END
             ), 0) AS total
      FROM ledger_entries le
      WHERE (
          (le.type = 'CREDIT' AND le.reference_type = 'referral')
          OR (le.type = 'DEBIT' AND le.reference_type = 'lead_reversal')
        )
        AND le.created_at >= ${from}
        AND le.created_at <= ${to}
      GROUP BY bucket
      ORDER BY bucket
    `,
  ]);

  const toMap = (rows: { bucket: string; total: unknown }[]) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.bucket) map.set(String(row.bucket), Number(row.total ?? 0));
    }
    return map;
  };

  return {
    advertiser: toMap(advertiserRows),
    publisher: toMap(publisherRows),
    referral: toMap(referralRows),
  };
}

export async function getAdminProfitForRange(from: Date, to: Date): Promise<AdminProfitSnapshot> {
  const [advertiserPayment, publisherPayout, referralPay] = await Promise.all([
    getAdvertiserPaymentsForRange(from, to),
    getPublisherPayoutsForRange(from, to),
    getReferralPayForRange(from, to),
  ]);

  return {
    advertiserPayment,
    publisherPayout,
    referralPay,
    adminProfit: advertiserPayment - publisherPayout - referralPay,
  };
}

export async function getAdminProfitSnapshots(ranges: {
  today: { from: Date; to: Date };
  last7Days: { from: Date; to: Date };
  last30Days: { from: Date; to: Date };
  lifetime: { from: Date; to: Date };
}) {
  const [today, last7Days, last30Days, lifetime] = await Promise.all([
    getAdminProfitForRange(ranges.today.from, ranges.today.to),
    getAdminProfitForRange(ranges.last7Days.from, ranges.last7Days.to),
    getAdminProfitForRange(ranges.last30Days.from, ranges.last30Days.to),
    getAdminProfitForRange(ranges.lifetime.from, ranges.lifetime.to),
  ]);

  return { today, last7Days, last30Days, lifetime };
}

export async function getAdminProfitPageData(
  from: Date,
  to: Date,
  groupBy: ProfitGroupBy,
): Promise<AdminProfitPageData> {
  const [snapshot, grouped] = await Promise.all([
    getAdminProfitForRange(from, to),
    getGroupedTotals(from, to, groupBy),
  ]);

  const split = splitPlatformProfit(snapshot.adminProfit);
  const buckets = generateProfitBuckets(from, to, groupBy).reverse();

  const rows: ProfitBreakdownRow[] = buckets.map((period) => {
    const advertiserPayment = roundMoney(grouped.advertiser.get(period) ?? 0);
    const publisherPayout = roundMoney(grouped.publisher.get(period) ?? 0);
    const referralPay = roundMoney(grouped.referral.get(period) ?? 0);
    const platformProfit = roundMoney(advertiserPayment - publisherPayout - referralPay);
    const shares = splitPlatformProfit(platformProfit);
    return {
      period,
      advertiserPayment,
      publisherPayout,
      referralPay,
      platformProfit: shares.platformProfit,
      adminProfit: shares.adminProfit,
      partnerProfit: shares.partnerProfit,
    };
  });

  return {
    from,
    to,
    groupBy,
    summary: {
      advertiserPayment: roundMoney(snapshot.advertiserPayment),
      publisherPayout: roundMoney(snapshot.publisherPayout),
      referralPay: roundMoney(snapshot.referralPay),
      platformProfit: split.platformProfit,
      adminProfit: split.adminProfit,
      partnerProfit: split.partnerProfit,
    },
    rows,
  };
}
