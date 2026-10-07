import { describe, expect, it } from "vitest";
import {
  buildPayoutReportRows,
  filterPayoutReportRows,
  invoiceReportStatus,
  monthlyPaidSeries,
  payoutReportStatus,
  sortPayoutReportRows,
  summarizePayoutReport,
  type PayoutReportInvoiceInput,
  type PayoutReportPayoutInput,
} from "@/lib/publisher-payout-report";
import { parsePerformanceSource, withPerformanceRatios } from "@/lib/publisher-performance";

const invoice = (over: Partial<PayoutReportInvoiceInput>): PayoutReportInvoiceInput => ({
  id: "inv1",
  number: "INV-0001",
  issuedAt: new Date("2026-09-07T00:00:00Z"),
  total: 100,
  status: "PAID",
  paidAt: new Date("2026-09-08T00:00:00Z"),
  paymentMethod: "WISE",
  payeeMethod: "WISE",
  payoutId: "pay-from-inv",
  ...over,
});

const payout = (over: Partial<PayoutReportPayoutInput>): PayoutReportPayoutInput => ({
  id: "pay1",
  createdAt: new Date("2026-08-01T00:00:00Z"),
  amount: 40,
  method: "BANK_TRANSFER",
  status: "COMPLETED",
  processedAt: new Date("2026-08-02T00:00:00Z"),
  idempotencyKey: null,
  ...over,
});

describe("payout report status mapping", () => {
  it("maps invoice statuses", () => {
    expect(invoiceReportStatus("PAID")).toBe("Paid");
    expect(invoiceReportStatus("UNPAID")).toBe("Pending");
    expect(invoiceReportStatus("PENDING_APPROVAL")).toBe("Pending");
  });

  it("maps payout statuses", () => {
    expect(payoutReportStatus("COMPLETED")).toBe("Paid");
    expect(payoutReportStatus("FAILED")).toBe("Rejected");
    expect(payoutReportStatus("REJECTED")).toBe("Rejected");
    expect(payoutReportStatus("PENDING")).toBe("Pending");
    expect(payoutReportStatus("PROCESSING")).toBe("Pending");
  });
});

describe("buildPayoutReportRows", () => {
  it("drops payouts created by an invoice and cancelled invoices", () => {
    const rows = buildPayoutReportRows(
      [
        invoice({}),
        invoice({ id: "inv2", number: "INV-0002", status: "CANCELLED", payoutId: null }),
        invoice({ id: "inv3", number: "INV-0003", status: "UNPAID", paidAt: null, payoutId: null, paymentMethod: null }),
      ],
      [
        payout({ id: "pay-from-inv" }),
        payout({ id: "pay-keyed", idempotencyKey: "invoice:inv9" }),
        payout({}),
      ],
    );
    expect(rows.map((r) => `${r.type}:${r.reference}`)).toEqual([
      "Invoice:INV-0001",
      "Invoice:INV-0003",
      "Payout:PAY1",
    ]);
    expect(rows[1]).toMatchObject({ status: "Pending", method: "WISE", paidAt: null });
    expect(rows[2]).toMatchObject({ status: "Paid", paidAt: "2026-08-02T00:00:00.000Z" });
  });

  it("filters, sorts and summarizes", () => {
    const rows = buildPayoutReportRows(
      [invoice({}), invoice({ id: "inv3", number: "INV-0003", status: "UNPAID", paidAt: null, payoutId: null })],
      [payout({}), payout({ id: "pay2", status: "REJECTED", processedAt: null })],
    );
    expect(filterPayoutReportRows(rows, { status: "Paid" })).toHaveLength(2);
    expect(filterPayoutReportRows(rows, { method: "WISE" })).toHaveLength(2);
    expect(filterPayoutReportRows(rows, { from: new Date("2026-09-01T00:00:00Z") })).toHaveLength(2);

    expect(sortPayoutReportRows(rows, {}).map((r) => r.date)).toEqual(
      [...rows.map((r) => r.date)].sort().reverse(),
    );
    expect(sortPayoutReportRows(rows, { sortBy: "amount", sortDir: "asc" })[0]!.amount).toBe(40);

    expect(summarizePayoutReport(rows)).toEqual({
      totalPaid: 140,
      pending: 100,
      lastPayout: { amount: 100, date: "2026-09-08T00:00:00.000Z" },
      count: 4,
    });

    const monthly = monthlyPaidSeries(rows, new Date("2026-10-07T00:00:00Z"));
    expect(monthly).toHaveLength(12);
    expect(monthly.at(-1)).toEqual({ month: "2026-10", paid: 0 });
    expect(monthly.find((m) => m.month === "2026-09")?.paid).toBe(100);
    expect(monthly.find((m) => m.month === "2026-08")?.paid).toBe(40);
  });
});

describe("performance ratios", () => {
  it("returns zero CR and EPC when there are no clicks", () => {
    expect(withPerformanceRatios({ clicks: 0, conversions: 2, earnings: 10 })).toEqual({
      clicks: 0,
      conversions: 2,
      earnings: 10,
      cr: 0,
      epc: 0,
    });
  });

  it("computes CR as a percentage and EPC per click", () => {
    expect(withPerformanceRatios({ clicks: 3, conversions: 1, earnings: 10 })).toEqual({
      clicks: 3,
      conversions: 1,
      earnings: 10,
      cr: 33.33,
      epc: 3.33,
    });
  });

  it("parses the source filter", () => {
    expect(parsePerformanceSource("cpa")).toBe("cpa");
    expect(parsePerformanceSource("offerwall")).toBe("all");
    expect(parsePerformanceSource(null)).toBe("all");
  });
});
