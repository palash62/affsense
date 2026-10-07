import { sortRows, type ReportSortQuery } from "@/lib/report-sort";

export type PayoutReportStatus = "Paid" | "Pending" | "Rejected";
export const PAYOUT_REPORT_STATUSES: PayoutReportStatus[] = ["Paid", "Pending", "Rejected"];

export type PayoutReportRow = {
  id: string;
  type: "Invoice" | "Payout";
  reference: string;
  /** ISO string: invoice issue date or payout request date. */
  date: string;
  amount: number;
  method: string | null;
  status: PayoutReportStatus;
  paidAt: string | null;
};

export type PayoutReportInvoiceInput = {
  id: string;
  number: string;
  issuedAt: Date;
  total: number;
  status: string;
  paidAt: Date | null;
  paymentMethod: string | null;
  payeeMethod: string | null;
  payoutId: string | null;
};

export type PayoutReportPayoutInput = {
  id: string;
  createdAt: Date;
  amount: number;
  method: string;
  status: string;
  processedAt: Date | null;
  idempotencyKey: string | null;
};

export function invoiceReportStatus(status: string): PayoutReportStatus {
  return status === "PAID" ? "Paid" : "Pending";
}

export function payoutReportStatus(status: string): PayoutReportStatus {
  if (status === "COMPLETED") return "Paid";
  if (status === "FAILED" || status === "REJECTED") return "Rejected";
  return "Pending";
}

/**
 * Paying an invoice creates its own Payout, so those payouts are dropped to avoid
 * counting the same payment twice. Cancelled invoices are left out entirely.
 */
export function buildPayoutReportRows(
  invoices: PayoutReportInvoiceInput[],
  payouts: PayoutReportPayoutInput[],
): PayoutReportRow[] {
  const live = invoices.filter((inv) => inv.status !== "CANCELLED");
  const invoicePayoutIds = new Set(invoices.flatMap((inv) => (inv.payoutId ? [inv.payoutId] : [])));

  const invoiceRows: PayoutReportRow[] = live.map((inv) => ({
    id: inv.id,
    type: "Invoice",
    reference: inv.number,
    date: inv.issuedAt.toISOString(),
    amount: inv.total,
    method: inv.paymentMethod ?? inv.payeeMethod,
    status: invoiceReportStatus(inv.status),
    paidAt: inv.paidAt?.toISOString() ?? null,
  }));

  const payoutRows: PayoutReportRow[] = payouts
    .filter((p) => !invoicePayoutIds.has(p.id) && !p.idempotencyKey?.startsWith("invoice:"))
    .map((p) => ({
      id: p.id,
      type: "Payout",
      reference: p.id.slice(-8).toUpperCase(),
      date: p.createdAt.toISOString(),
      amount: p.amount,
      method: p.method,
      status: payoutReportStatus(p.status),
      paidAt: p.status === "COMPLETED" ? (p.processedAt ?? p.createdAt).toISOString() : null,
    }));

  return [...invoiceRows, ...payoutRows];
}

export type PayoutReportFilters = {
  from?: Date;
  to?: Date;
  status?: string;
  method?: string;
};

export function filterPayoutReportRows(rows: PayoutReportRow[], filters: PayoutReportFilters) {
  const from = filters.from?.getTime();
  const to = filters.to?.getTime();
  return rows.filter((row) => {
    const at = new Date(row.date).getTime();
    if (from !== undefined && at < from) return false;
    if (to !== undefined && at > to) return false;
    if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.method && filters.method !== "all" && row.method !== filters.method) return false;
    return true;
  });
}

export const PAYOUT_REPORT_SORT_ACCESSORS: Record<string, (row: PayoutReportRow) => string | number | null> = {
  date: (row) => row.date,
  type: (row) => row.type,
  reference: (row) => row.reference,
  method: (row) => row.method,
  amount: (row) => row.amount,
  status: (row) => row.status,
  paidAt: (row) => row.paidAt,
};

export function sortPayoutReportRows(rows: PayoutReportRow[], sort: ReportSortQuery) {
  const query = sort.sortBy && PAYOUT_REPORT_SORT_ACCESSORS[sort.sortBy] ? sort : { sortBy: "date", sortDir: "desc" as const };
  return sortRows(rows, query, PAYOUT_REPORT_SORT_ACCESSORS);
}

export type PayoutReportKpis = {
  totalPaid: number;
  pending: number;
  lastPayout: { amount: number; date: string } | null;
  count: number;
};

export function summarizePayoutReport(rows: PayoutReportRow[]): PayoutReportKpis {
  let totalPaid = 0;
  let pending = 0;
  let lastPayout: PayoutReportKpis["lastPayout"] = null;
  for (const row of rows) {
    if (row.status === "Paid") {
      totalPaid += row.amount;
      const paidAt = row.paidAt ?? row.date;
      if (!lastPayout || paidAt > lastPayout.date) lastPayout = { amount: row.amount, date: paidAt };
    } else if (row.status === "Pending") {
      pending += row.amount;
    }
  }
  return {
    totalPaid: Math.round(totalPaid * 100) / 100,
    pending: Math.round(pending * 100) / 100,
    lastPayout,
    count: rows.length,
  };
}

/** Paid amounts for the 12 months ending with `now`'s month, bucketed by paid date (UTC). */
export function monthlyPaidSeries(rows: PayoutReportRow[], now = new Date()) {
  const months: { month: string; paid: number }[] = [];
  const index = new Map<string, number>();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    index.set(key, months.length);
    months.push({ month: key, paid: 0 });
  }
  for (const row of rows) {
    if (row.status !== "Paid") continue;
    const slot = index.get((row.paidAt ?? row.date).slice(0, 7));
    if (slot !== undefined) months[slot]!.paid = Math.round((months[slot]!.paid + row.amount) * 100) / 100;
  }
  return months;
}
