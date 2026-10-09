import { parseISO, startOfDay } from "date-fns";
import { Prisma, type PartnerInvoiceStatus } from "@prisma/client";
import { loadSoloAdsConfig } from "@cpl/tracking-core";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import {
  isValidPeriodMonth,
  type InvoiceProfitRow,
  type InvoiceProfitTotals,
  type PartnerInvoiceRecord,
  type PartnerInvoiceSummary,
  type ProfitLines,
} from "@/lib/partner-invoice";
import {
  generateProfitBuckets,
  splitPlatformProfit,
  type ProfitGroupBy,
} from "@/services/admin-profit.service";
import { getDigitalSaleAmountsByBucket } from "@/services/digital-product.service";

/** Safety cap for the first backfill run. */
const MAX_BACKFILL_MONTHS = 120;

export type InvoiceProfitPageData = {
  from: Date;
  to: Date;
  groupBy: ProfitGroupBy;
  summary: InvoiceProfitTotals;
  rows: InvoiceProfitRow[];
};

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

export const EMPTY_PROFIT_LINES: ProfitLines = {
  digitalSales: 0,
  digitalRefunds: 0,
  offerwall: 0,
  soloAds: 0,
  cpaInvoices: 0,
  digitalCommissions: 0,
  otherCommissions: 0,
  referralCommissions: 0,
  soloProviderCost: 0,
};

/**
 * Platform profit = income (marketplace sales − refunds + offer wall + Solo Ads + paid CPA
 * invoices) − costs (affiliate and referral commissions + Solo Ads provider cost).
 */
export function buildProfitTotals(input: Partial<ProfitLines>): InvoiceProfitTotals {
  const lines = Object.fromEntries(
    Object.entries({ ...EMPTY_PROFIT_LINES, ...input }).map(([key, value]) => [key, roundMoney(value)]),
  ) as ProfitLines;
  const income = roundMoney(
    lines.digitalSales - lines.digitalRefunds + lines.offerwall + lines.soloAds + lines.cpaInvoices,
  );
  const affiliateCommissions = roundMoney(lines.digitalCommissions + lines.otherCommissions);
  const costs = roundMoney(affiliateCommissions + lines.referralCommissions + lines.soloProviderCost);
  return {
    ...lines,
    income,
    affiliateCommissions,
    costs,
    ...splitPlatformProfit(roundMoney(income - costs)),
  };
}

export function utcMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The calendar month (UTC) before the one containing `now`. */
export function previousUtcMonth(now: Date): string {
  return utcMonthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

export function utcMonthRange(periodMonth: string): { start: Date; end: Date } {
  const [y, m] = periodMonth.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 1) - 1);
  return { start, end };
}

/** Every YYYY-MM from `fromMonth` to `toMonth` inclusive. */
export function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const months: string[] = [];
  let [y, m] = fromMonth.split("-").map(Number) as [number, number];
  const [ty, tm] = toMonth.split("-").map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export function parsePaidAtInput(value: unknown): Date {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return startOfDay(parseISO(trimmed));
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
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

type BucketRow = { bucket: string | null; total: unknown };

function toMap(rows: BucketRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.bucket) map.set(String(row.bucket), Number(row.total ?? 0));
  }
  return map;
}

/** Wallet ledger earnings that are commission costs (reference types are mixed case). */
const OTHER_COMMISSION_REFERENCES = ["lead", "lead_reversal", "offerwall_conversion"];
const REFERRAL_COMMISSION_REFERENCES = [
  "referral",
  "referral_digital",
  "referral_digital_reversal",
  "referral_cpa",
];

function ledgerNetByBucket(pattern: string, from: Date, to: Date, referenceTypes: string[]) {
  return prisma.$queryRaw<BucketRow[]>`
    SELECT DATE_FORMAT(created_at, ${pattern}) AS bucket,
           COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0) AS total
    FROM ledger_entries
    WHERE LOWER(reference_type) IN (${Prisma.join(referenceTypes)})
      AND created_at >= ${from} AND created_at <= ${to}
    GROUP BY bucket
  `;
}

async function getGroupedProfitLines(
  from: Date,
  to: Date,
  groupBy: ProfitGroupBy,
): Promise<Map<string, ProfitLines>> {
  const pattern = dateFormatPattern(groupBy);
  const soloConfig = await loadSoloAdsConfig();

  const [cpaRows, offerwallRows, soloRows, otherRows, referralRows, digital] = await Promise.all([
    prisma.$queryRaw<BucketRow[]>`
      SELECT DATE_FORMAT(paid_at, ${pattern}) AS bucket, COALESCE(SUM(total), 0) AS total
      FROM advertiser_cpa_invoices
      WHERE status = 'PAID' AND paid_at >= ${from} AND paid_at <= ${to}
      GROUP BY bucket
    `,
    prisma.$queryRaw<BucketRow[]>`
      SELECT DATE_FORMAT(created_at, ${pattern}) AS bucket,
             COALESCE(SUM(COALESCE(network_payout, payout)), 0) AS total
      FROM offerwall_conversions
      WHERE created_at >= ${from} AND created_at <= ${to}
      GROUP BY bucket
    `,
    // A click refund gives back the charge and the provider cost of that click.
    prisma.$queryRaw<Array<{ bucket: string | null; charges: unknown; providerCents: unknown }>>`
      SELECT DATE_FORMAT(l.created_at, ${pattern}) AS bucket,
             COALESCE(-SUM(l.amount_cents), 0) AS charges,
             COALESCE(SUM(
               CASE WHEN l.type = 'CHARGE' THEN 1 ELSE -1 END *
               COALESCE(c.provider_cost_cents_snapshot,
                        CASE WHEN k.traffic_type = 'WARM' THEN ${soloConfig.warmProviderCostCents}
                             ELSE ${soloConfig.regularProviderCostCents} END)
             ), 0) AS providerCents
      FROM solo_wallet_ledger l
      LEFT JOIN solo_clicks k ON k.id = l.source_id
      LEFT JOIN solo_campaigns c ON c.id = k.campaign_id
      WHERE l.type IN ('CHARGE', 'REFUND') AND l.source_type = 'solo_click'
        AND l.created_at >= ${from} AND l.created_at <= ${to}
      GROUP BY bucket
    `,
    ledgerNetByBucket(pattern, from, to, OTHER_COMMISSION_REFERENCES),
    ledgerNetByBucket(pattern, from, to, REFERRAL_COMMISSION_REFERENCES),
    getDigitalSaleAmountsByBucket(from, to, groupBy),
  ]);

  const result = new Map<string, ProfitLines>();
  const line = (bucket: string) => {
    let lines = result.get(bucket);
    if (!lines) {
      lines = { ...EMPTY_PROFIT_LINES };
      result.set(bucket, lines);
    }
    return lines;
  };

  for (const [bucket, total] of toMap(cpaRows)) line(bucket).cpaInvoices += total;
  for (const [bucket, total] of toMap(offerwallRows)) line(bucket).offerwall += total;
  for (const [bucket, total] of toMap(otherRows)) line(bucket).otherCommissions += total;
  for (const [bucket, total] of toMap(referralRows)) line(bucket).referralCommissions += total;
  for (const row of soloRows) {
    if (!row.bucket) continue;
    const lines = line(String(row.bucket));
    lines.soloAds += Number(row.charges ?? 0) / 100;
    lines.soloProviderCost += Number(row.providerCents ?? 0) / 100;
  }
  for (const [bucket, sale] of digital) {
    const lines = line(bucket);
    lines.digitalSales += sale.sales;
    lines.digitalRefunds += sale.refunds;
    lines.digitalCommissions += sale.commissions - sale.refundedCommissions;
  }
  return result;
}

function sumLines(map: Map<string, ProfitLines>): ProfitLines {
  const total = { ...EMPTY_PROFIT_LINES };
  for (const lines of map.values()) {
    for (const key of Object.keys(total) as Array<keyof ProfitLines>) total[key] += lines[key];
  }
  return total;
}

/** Every amount is dated by when it happened: sale, conversion, click charge, credit, refund. */
export async function getInvoiceProfitForRange(from: Date, to: Date): Promise<InvoiceProfitTotals> {
  return buildProfitTotals(sumLines(await getGroupedProfitLines(from, to, "year")));
}

export async function getInvoiceProfitPageData(
  from: Date,
  to: Date,
  groupBy: ProfitGroupBy,
): Promise<InvoiceProfitPageData> {
  const grouped = await getGroupedProfitLines(from, to, groupBy);
  const rows = generateProfitBuckets(from, to, groupBy)
    .reverse()
    .map((period) => ({ period, ...buildProfitTotals(grouped.get(period) ?? {}) }));

  return {
    from,
    to,
    groupBy,
    summary: buildProfitTotals(sumLines(grouped)),
    rows,
  };
}

const invoiceInclude = { paidBy: { select: { name: true } } } as const;

type InvoiceWithPaidBy = Prisma.PartnerProfitInvoiceGetPayload<{ include: typeof invoiceInclude }>;

function serializeInvoice(row: InvoiceWithPaidBy): PartnerInvoiceRecord {
  return {
    id: row.id,
    number: row.number,
    periodMonth: row.periodMonth,
    received: Number(row.received),
    affiliateSent: Number(row.affiliateSent),
    referralSent: Number(row.referralSent),
    soloProviderCost: Number(row.soloProviderCost),
    breakdown: (row.breakdown as InvoiceProfitTotals | null) ?? null,
    platformProfit: Number(row.platformProfit),
    amount: Number(row.amount),
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    paidNote: row.paidNote,
    paidByName: row.paidBy?.name ?? null,
  };
}

export function partnerInvoiceStatusFor(amount: number): PartnerInvoiceStatus {
  return amount > 0 ? "UNPAID" : "NOTHING_DUE";
}

/** Creates the invoice for a finished month once; later calls return the existing one. */
export async function generatePartnerInvoice(
  periodMonth: string,
  now: Date = new Date(),
): Promise<{ created: boolean; invoice: PartnerInvoiceRecord }> {
  if (!isValidPeriodMonth(periodMonth)) {
    throw Errors.validation("periodMonth must be YYYY-MM", "periodMonth");
  }
  if (periodMonth >= utcMonthKey(now)) {
    throw Errors.validation("Only finished months can be invoiced", "periodMonth");
  }

  const existing = await prisma.partnerProfitInvoice.findUnique({
    where: { periodMonth },
    include: invoiceInclude,
  });
  if (existing) return { created: false, invoice: serializeInvoice(existing) };

  const { start, end } = utcMonthRange(periodMonth);
  const totals = await getInvoiceProfitForRange(start, end);
  const amount = Math.max(0, totals.partnerProfit);

  try {
    const created = await prisma.partnerProfitInvoice.create({
      data: {
        number: `PP-${periodMonth}`,
        periodMonth,
        periodStart: start,
        periodEnd: end,
        received: totals.income,
        affiliateSent: totals.affiliateCommissions,
        referralSent: totals.referralCommissions,
        soloProviderCost: totals.soloProviderCost,
        platformProfit: totals.platformProfit,
        breakdown: totals,
        amount,
        status: partnerInvoiceStatusFor(amount),
        issuedAt: now,
      },
      include: invoiceInclude,
    });
    return { created: true, invoice: serializeInvoice(created) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const row = await prisma.partnerProfitInvoice.findUniqueOrThrow({
        where: { periodMonth },
        include: invoiceInclude,
      });
      return { created: false, invoice: serializeInvoice(row) };
    }
    throw error;
  }
}

async function firstMoneyMovementMonth(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ first: Date | null }[]>`
    SELECT MIN(first) AS first FROM (
      SELECT MIN(paid_at) AS first FROM advertiser_cpa_invoices WHERE status = 'PAID'
      UNION ALL
      SELECT MIN(created_at) FROM webhook_events
        WHERE status = 'PROCESSED' AND publisher_id IS NOT NULL
      UNION ALL
      SELECT MIN(created_at) FROM offerwall_conversions
      UNION ALL
      SELECT MIN(created_at) FROM solo_wallet_ledger WHERE type = 'CHARGE'
      UNION ALL
      SELECT MIN(created_at) FROM ledger_entries
        WHERE LOWER(reference_type) IN (${Prisma.join([
          ...OTHER_COMMISSION_REFERENCES,
          ...REFERRAL_COMMISSION_REFERENCES,
        ])})
    ) AS movements
  `;
  const first = rows[0]?.first;
  return first ? utcMonthKey(new Date(first)) : null;
}

/**
 * Monthly run (1st of the month): invoices the month that just ended and any earlier month
 * that has no invoice yet, back to the first month with money movement.
 */
export async function generateDuePartnerInvoices(now: Date = new Date()) {
  const lastMonth = previousUtcMonth(now);
  const firstMonth = (await firstMoneyMovementMonth()) ?? lastMonth;
  const months = monthsBetween(firstMonth < lastMonth ? firstMonth : lastMonth, lastMonth).slice(
    -MAX_BACKFILL_MONTHS,
  );

  const created: string[] = [];
  const existing: string[] = [];
  for (const month of months) {
    const result = await generatePartnerInvoice(month, now);
    (result.created ? created : existing).push(month);
  }
  return { created, existing };
}

export async function listPartnerInvoices(): Promise<PartnerInvoiceRecord[]> {
  const rows = await prisma.partnerProfitInvoice.findMany({
    include: invoiceInclude,
    orderBy: { periodMonth: "desc" },
  });
  return rows.map(serializeInvoice);
}

export function summarizePartnerInvoices(invoices: PartnerInvoiceRecord[]): PartnerInvoiceSummary {
  const summary: PartnerInvoiceSummary = { unpaid: 0, unpaidCount: 0, paid: 0, paidCount: 0 };
  for (const invoice of invoices) {
    if (invoice.status === "UNPAID") {
      summary.unpaid = roundMoney(summary.unpaid + invoice.amount);
      summary.unpaidCount += 1;
    } else if (invoice.status === "PAID") {
      summary.paid = roundMoney(summary.paid + invoice.amount);
      summary.paidCount += 1;
    }
  }
  return summary;
}

export async function markPartnerInvoicePaid(
  invoiceId: string,
  input: { paidAt: Date; method: string; reference?: string | null; note?: string | null },
  adminId: string,
): Promise<PartnerInvoiceRecord> {
  if (Number.isNaN(input.paidAt.getTime())) {
    throw Errors.validation("paidAt must be a valid date", "paidAt");
  }
  const method = input.method.trim();
  if (!method) throw Errors.validation("Payment method is required", "method");

  const admin = await prisma.user.findFirst({
    where: { id: adminId, role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) throw Errors.forbidden();

  const reference = input.reference?.trim() || null;
  const note = input.note?.trim() || null;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.partnerProfitInvoice.updateMany({
      where: { id: invoiceId, status: "UNPAID" },
      data: {
        status: "PAID",
        paidAt: input.paidAt,
        paymentMethod: method,
        paymentReference: reference,
        paidNote: note,
        paidById: adminId,
      },
    });

    if (result.count === 0) {
      const current = await tx.partnerProfitInvoice.findUnique({
        where: { id: invoiceId },
        select: { status: true },
      });
      if (!current) throw Errors.notFound("Invoice");
      throw Errors.validation(
        current.status === "PAID" ? "Invoice is already paid" : "Nothing is due on this invoice",
      );
    }

    const row = await tx.partnerProfitInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "partner_invoice.paid",
        entityType: "partner_profit_invoice",
        entityId: invoiceId,
        metadata: {
          number: row.number,
          amount: Number(row.amount),
          paidAt: input.paidAt.toISOString(),
          method,
          reference,
        },
      },
    });

    return row;
  });

  return serializeInvoice(updated);
}
