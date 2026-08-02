import {
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import {
  getAdminProfitPageData,
  splitPlatformProfit,
} from "@/services/admin-profit.service";

const PERIOD_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type PartnerSettlementStatus = "unpaid" | "partial" | "settled" | "overpaid";

export type PartnerSettlementRow = {
  periodMonth: string;
  owed: number;
  paid: number;
  remaining: number;
  status: PartnerSettlementStatus;
};

export type PartnerPaymentRecord = {
  id: string;
  periodMonth: string;
  amount: number;
  paidAt: string;
  method: string | null;
  note: string | null;
  createdById: string;
  createdByName: string | null;
  createdAt: string;
};

export type PartnerSettlementSummary = {
  owed: number;
  paid: number;
  remaining: number;
};

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function isValidPeriodMonth(value: string): boolean {
  if (!PERIOD_MONTH_RE.test(value)) return false;
  const parsed = parseISO(`${value}-01`);
  return !Number.isNaN(parsed.getTime()) && format(parsed, "yyyy-MM") === value;
}

export function partnerSettlementStatus(owed: number, paid: number): PartnerSettlementStatus {
  const remaining = roundMoney(owed - paid);
  if (paid <= 0 && owed > 0) return "unpaid";
  if (paid <= 0 && owed <= 0) return "settled";
  if (remaining < 0) return "overpaid";
  if (remaining === 0) return "settled";
  return "partial";
}

/** Pure helper for tests and API composition. */
export function buildPartnerSettlementRows(
  months: string[],
  owedByMonth: Map<string, number>,
  paidByMonth: Map<string, number>,
): PartnerSettlementRow[] {
  return months.map((periodMonth) => {
    const owed = roundMoney(owedByMonth.get(periodMonth) ?? 0);
    const paid = roundMoney(paidByMonth.get(periodMonth) ?? 0);
    const remaining = roundMoney(owed - paid);
    return {
      periodMonth,
      owed,
      paid,
      remaining,
      status: partnerSettlementStatus(owed, paid),
    };
  });
}

export function summarizePartnerSettlement(rows: PartnerSettlementRow[]): PartnerSettlementSummary {
  const owed = roundMoney(rows.reduce((sum, row) => sum + row.owed, 0));
  const paid = roundMoney(rows.reduce((sum, row) => sum + row.paid, 0));
  return {
    owed,
    paid,
    remaining: roundMoney(owed - paid),
  };
}

export function monthsInRange(from: Date, to: Date): string[] {
  return eachMonthOfInterval({ start: startOfMonth(from), end: startOfMonth(to) }).map((d) =>
    format(d, "yyyy-MM"),
  );
}

function toMoneyNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function serializePayment(row: {
  id: string;
  periodMonth: string;
  amount: unknown;
  paidAt: Date;
  method: string | null;
  note: string | null;
  createdById: string;
  createdAt: Date;
  createdBy?: { name: string } | null;
}): PartnerPaymentRecord {
  return {
    id: row.id,
    periodMonth: row.periodMonth,
    amount: toMoneyNumber(row.amount),
    paidAt: row.paidAt.toISOString(),
    method: row.method,
    note: row.note,
    createdById: row.createdById,
    createdByName: row.createdBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createPartnerPayment(input: {
  periodMonth: string;
  amount: number;
  paidAt: Date;
  method?: string | null;
  note?: string | null;
  adminId: string;
}) {
  if (!isValidPeriodMonth(input.periodMonth)) {
    throw Errors.validation("periodMonth must be YYYY-MM", "periodMonth");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Errors.validation("amount must be greater than 0", "amount");
  }
  if (Number.isNaN(input.paidAt.getTime())) {
    throw Errors.validation("paidAt must be a valid date", "paidAt");
  }

  const admin = await prisma.user.findFirst({
    where: { id: input.adminId, role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) {
    throw Errors.forbidden();
  }

  const method = input.method?.trim() || null;
  const note = input.note?.trim() || null;

  const created = await prisma.partnerPayment.create({
    data: {
      periodMonth: input.periodMonth,
      amount: roundMoney(input.amount),
      paidAt: input.paidAt,
      method,
      note,
      createdById: input.adminId,
    },
    include: { createdBy: { select: { name: true } } },
  });

  return serializePayment(created);
}

export async function listPartnerPayments(options: {
  fromMonth?: string;
  toMonth?: string;
}): Promise<PartnerPaymentRecord[]> {
  if (options.fromMonth && !isValidPeriodMonth(options.fromMonth)) {
    throw Errors.validation("from must be YYYY-MM", "from");
  }
  if (options.toMonth && !isValidPeriodMonth(options.toMonth)) {
    throw Errors.validation("to must be YYYY-MM", "to");
  }

  const rows = await prisma.partnerPayment.findMany({
    where: {
      ...(options.fromMonth || options.toMonth
        ? {
            periodMonth: {
              ...(options.fromMonth ? { gte: options.fromMonth } : {}),
              ...(options.toMonth ? { lte: options.toMonth } : {}),
            },
          }
        : {}),
    },
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(serializePayment);
}

async function paidTotalsByMonth(months: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const month of months) map.set(month, 0);
  if (months.length === 0) return map;

  const fromMonth = months[0]!;
  const toMonth = months[months.length - 1]!;

  const grouped = await prisma.partnerPayment.groupBy({
    by: ["periodMonth"],
    where: {
      periodMonth: { gte: fromMonth, lte: toMonth },
    },
    _sum: { amount: true },
  });

  for (const row of grouped) {
    map.set(row.periodMonth, Number(row._sum.amount ?? 0));
  }
  return map;
}

export async function getPartnerSettlementByMonth(
  from: Date,
  to: Date,
): Promise<{
  rows: PartnerSettlementRow[];
  summary: PartnerSettlementSummary;
  payments: PartnerPaymentRecord[];
}> {
  const months = monthsInRange(from, to);
  const monthStart = startOfMonth(from);
  const monthEnd = endOfDay(endOfMonth(to));

  const [profitData, paidByMonth, payments] = await Promise.all([
    getAdminProfitPageData(monthStart, monthEnd, "month"),
    paidTotalsByMonth(months),
    listPartnerPayments({
      fromMonth: months[0],
      toMonth: months[months.length - 1],
    }),
  ]);

  const owedByMonth = new Map<string, number>();
  for (const row of profitData.rows) {
    owedByMonth.set(row.period, row.partnerProfit);
  }

  // Newest month first to match profit report ordering.
  const rows = buildPartnerSettlementRows([...months].reverse(), owedByMonth, paidByMonth);
  return {
    rows,
    summary: summarizePartnerSettlement(rows),
    payments,
  };
}

/** Convenience for callers that already know platform profit for a single month. */
export function partnerOwedFromPlatformProfit(platformProfit: number): number {
  return splitPlatformProfit(platformProfit).partnerProfit;
}

export function parsePaidAtInput(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.trim()) {
    // Accept YYYY-MM-DD as local calendar day start
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return startOfDay(parseISO(value.trim()));
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return startOfDay(new Date());
}
