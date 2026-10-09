import { format, parseISO } from "date-fns";

export type PartnerInvoiceStatusValue = "UNPAID" | "PAID" | "NOTHING_DUE";

/** The raw income and cost lines of a period, before totals and the split. */
export type ProfitLines = {
  /** Affiliate marketplace sales (Report Log), by sale date. */
  digitalSales: number;
  /** Marketplace refunds, by the date the refund arrived. */
  digitalRefunds: number;
  /** What the offer wall network paid us. */
  offerwall: number;
  /** Solo Ads click charges net of click refunds. */
  soloAds: number;
  /** Paid CPA advertiser invoices, by payment date. */
  cpaInvoices: number;
  /** Marketplace commissions by sale date, less commission taken back by refunds. */
  digitalCommissions: number;
  /** Offer wall and CPL commissions credited to wallets, net of reversals. */
  otherCommissions: number;
  /** Referral commissions credited to wallets, net of reversals. */
  referralCommissions: number;
  /** Billed Solo Ads clicks times the provider cost per click. */
  soloProviderCost: number;
};

/** Display order of the income lines; refunds are subtracted. */
export const PROFIT_INCOME_LINES: Array<{ key: keyof ProfitLines; label: string; subtract?: boolean }> = [
  { key: "digitalSales", label: "Marketplace sales" },
  { key: "digitalRefunds", label: "Marketplace refunds", subtract: true },
  { key: "offerwall", label: "Offer Wall network payout" },
  { key: "soloAds", label: "Solo Ads click charges" },
  { key: "cpaInvoices", label: "CPA advertiser invoices paid" },
];

export const PROFIT_COST_LINES: Array<{ key: keyof ProfitLines; label: string }> = [
  { key: "digitalCommissions", label: "Marketplace affiliate commissions" },
  { key: "otherCommissions", label: "Offer Wall / CPL affiliate commissions" },
  { key: "referralCommissions", label: "Referral commissions" },
  { key: "soloProviderCost", label: "Solo Ads provider cost" },
];

export type InvoiceProfitTotals = ProfitLines & {
  income: number;
  affiliateCommissions: number;
  costs: number;
  platformProfit: number;
  adminProfit: number;
  partnerProfit: number;
};

export type InvoiceProfitRow = InvoiceProfitTotals & { period: string };

export type PartnerInvoiceRecord = {
  id: string;
  number: string;
  periodMonth: string;
  /** Total income. */
  received: number;
  /** Affiliate commissions. */
  affiliateSent: number;
  /** Referral commissions. */
  referralSent: number;
  soloProviderCost: number;
  /** Every line; null on invoices issued before the breakdown existed. */
  breakdown: InvoiceProfitTotals | null;
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
