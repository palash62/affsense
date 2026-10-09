import { parseISO, startOfDay } from "date-fns";
import { Prisma, type PartnerInvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import {
  isValidPeriodMonth,
  type InvoiceProfitRow,
  type InvoiceProfitTotals,
  type PartnerInvoiceRecord,
  type PartnerInvoiceSummary,
} from "@/lib/partner-invoice";
import {
  generateProfitBuckets,
  splitPlatformProfit,
  type ProfitGroupBy,
} from "@/services/admin-profit.service";

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

export function buildProfitTotals(
  received: number,
  affiliateSent: number,
  referralSent: number,
): InvoiceProfitTotals {
  const split = splitPlatformProfit(roundMoney(received - affiliateSent - referralSent));
  return {
    received: roundMoney(received),
    affiliateSent: roundMoney(affiliateSent),
    referralSent: roundMoney(referralSent),
    ...split,
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

function sumMap(map: Map<string, number>) {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}

async function getGroupedInvoiceTotals(from: Date, to: Date, groupBy: ProfitGroupBy) {
  const pattern = dateFormatPattern(groupBy);

  const [receivedRows, affiliateRows, referralRows] = await Promise.all([
    prisma.$queryRaw<BucketRow[]>`
      SELECT DATE_FORMAT(paid_at, ${pattern}) AS bucket, COALESCE(SUM(total), 0) AS total
      FROM advertiser_cpa_invoices
      WHERE status = 'PAID' AND paid_at >= ${from} AND paid_at <= ${to}
      GROUP BY bucket
    `,
    prisma.$queryRaw<BucketRow[]>`
      SELECT DATE_FORMAT(paid_at, ${pattern}) AS bucket, COALESCE(SUM(total), 0) AS total
      FROM affiliate_invoices
      WHERE status = 'PAID' AND paid_at >= ${from} AND paid_at <= ${to}
      GROUP BY bucket
    `,
    prisma.$queryRaw<BucketRow[]>`
      SELECT DATE_FORMAT(COALESCE(processed_at, created_at), ${pattern}) AS bucket,
             COALESCE(SUM(amount), 0) AS total
      FROM payouts
      WHERE kind = 'REFERRAL' AND status = 'COMPLETED'
        AND COALESCE(processed_at, created_at) >= ${from}
        AND COALESCE(processed_at, created_at) <= ${to}
      GROUP BY bucket
    `,
  ]);

  return {
    received: toMap(receivedRows),
    affiliate: toMap(affiliateRows),
    referral: toMap(referralRows),
  };
}

/**
 * Platform profit = paid advertiser invoices − paid affiliate invoices − completed referral
 * payouts, each dated by when it was paid. Payouts created by paying an affiliate invoice are
 * not counted again.
 */
export async function getInvoiceProfitForRange(from: Date, to: Date): Promise<InvoiceProfitTotals> {
  const grouped = await getGroupedInvoiceTotals(from, to, "year");
  return buildProfitTotals(
    sumMap(grouped.received),
    sumMap(grouped.affiliate),
    sumMap(grouped.referral),
  );
}

export async function getInvoiceProfitPageData(
  from: Date,
  to: Date,
  groupBy: ProfitGroupBy,
): Promise<InvoiceProfitPageData> {
  const grouped = await getGroupedInvoiceTotals(from, to, groupBy);
  const rows = generateProfitBuckets(from, to, groupBy)
    .reverse()
    .map((period) => ({
      period,
      ...buildProfitTotals(
        grouped.received.get(period) ?? 0,
        grouped.affiliate.get(period) ?? 0,
        grouped.referral.get(period) ?? 0,
      ),
    }));

  return {
    from,
    to,
    groupBy,
    summary: buildProfitTotals(
      sumMap(grouped.received),
      sumMap(grouped.affiliate),
      sumMap(grouped.referral),
    ),
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
        received: totals.received,
        affiliateSent: totals.affiliateSent,
        referralSent: totals.referralSent,
        platformProfit: totals.platformProfit,
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
      SELECT MIN(paid_at) FROM affiliate_invoices WHERE status = 'PAID'
      UNION ALL
      SELECT MIN(COALESCE(processed_at, created_at)) FROM payouts
        WHERE kind = 'REFERRAL' AND status = 'COMPLETED'
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
