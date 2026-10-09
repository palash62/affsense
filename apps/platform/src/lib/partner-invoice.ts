import { format, parseISO } from "date-fns";

export type PartnerInvoiceStatusValue = "UNPAID" | "PAID" | "NOTHING_DUE";

export type InvoiceProfitTotals = {
  /** Paid advertiser invoices (money in). */
  received: number;
  /** Paid affiliate invoices (money out). */
  affiliateSent: number;
  /** Completed referral payouts (money out). */
  referralSent: number;
  platformProfit: number;
  adminProfit: number;
  partnerProfit: number;
};

export type InvoiceProfitRow = InvoiceProfitTotals & { period: string };

export type PartnerInvoiceRecord = {
  id: string;
  number: string;
  periodMonth: string;
  received: number;
  affiliateSent: number;
  referralSent: number;
  platformProfit: number;
  amount: number;
  status: PartnerInvoiceStatusValue;
  issuedAt: string;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidNote: string | null;
  paidByName: string | null;
};

export type PartnerInvoiceSummary = {
  unpaid: number;
  unpaidCount: number;
  paid: number;
  paidCount: number;
};

const PERIOD_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidPeriodMonth(value: string): boolean {
  if (!PERIOD_MONTH_RE.test(value)) return false;
  const parsed = parseISO(`${value}-01`);
  return !Number.isNaN(parsed.getTime()) && format(parsed, "yyyy-MM") === value;
}

/** Human label for a stored YYYY-MM period, e.g. "July 2026". */
export function formatPartnerPeriodMonthLabel(periodMonth: string): string {
  if (!isValidPeriodMonth(periodMonth)) return periodMonth;
  return format(parseISO(`${periodMonth}-01`), "MMMM yyyy");
}

/** Calendar date from an ISO timestamp, without timezone shifts, e.g. "05 Oct 2026". */
export function formatPartnerDate(value: string | null | undefined): string {
  if (!value) return "—";
  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "—";
  return format(parseISO(day), "dd MMM yyyy");
}
