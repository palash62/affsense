import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    user: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    partnerProfitInvoice: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) => fn(mock));
  return mock;
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  buildProfitTotals,
  generateDuePartnerInvoices,
  generatePartnerInvoice,
  getInvoiceProfitForRange,
  markPartnerInvoicePaid,
  monthsBetween,
  partnerInvoiceStatusFor,
  previousUtcMonth,
  summarizePartnerInvoices,
  utcMonthRange,
} from "@/services/partner-invoice.service";
import type { PartnerInvoiceRecord } from "@/lib/partner-invoice";

function sqlText(callArgs: unknown[]): string {
  const first = callArgs[0];
  if (Array.isArray(first)) return first.join("?");
  if (first && typeof first === "object" && "strings" in first) {
    return (first as { strings: string[] }).strings.join("?");
  }
  return String(first ?? "");
}

/** Routes each raw query to a total by the table it reads. */
function mockTotals(totals: { received: number; affiliate: number; referral: number }) {
  prismaMock.$queryRaw.mockImplementation((...args: unknown[]) => {
    const sql = sqlText(args);
    if (sql.includes("MIN(")) return Promise.resolve([{ first: null }]);
    if (sql.includes("advertiser_cpa_invoices")) {
      return Promise.resolve([{ bucket: "2026", total: totals.received }]);
    }
    if (sql.includes("affiliate_invoices")) {
      return Promise.resolve([{ bucket: "2026", total: totals.affiliate }]);
    }
    if (sql.includes("payouts")) return Promise.resolve([{ bucket: "2026", total: totals.referral }]);
    return Promise.resolve([]);
  });
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_1",
    number: "PP-2026-09",
    periodMonth: "2026-09",
    received: 1000,
    affiliateSent: 400,
    referralSent: 100,
    platformProfit: 500,
    amount: 100,
    status: "UNPAID",
    issuedAt: new Date("2026-10-01T00:15:00Z"),
    paidAt: null,
    paymentMethod: null,
    paymentReference: null,
    paidNote: null,
    paidBy: null,
    ...overrides,
  };
}

describe("partner invoice profit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("splits received minus affiliate and referral payments 80/20", () => {
    expect(buildProfitTotals(1000, 400, 100)).toEqual({
      received: 1000,
      affiliateSent: 400,
      referralSent: 100,
      platformProfit: 500,
      adminProfit: 400,
      partnerProfit: 100,
    });
  });

  it("only reads paid advertiser and affiliate invoices and completed referral payouts", async () => {
    mockTotals({ received: 1000, affiliate: 400, referral: 100 });

    const totals = await getInvoiceProfitForRange(new Date("2026-09-01"), new Date("2026-09-30"));
    expect(totals.platformProfit).toBe(500);

    const sql = prismaMock.$queryRaw.mock.calls.map((call) => sqlText(call));
    const advertiser = sql.find((s) => s.includes("advertiser_cpa_invoices"))!;
    const affiliate = sql.find((s) => s.includes("FROM affiliate_invoices"))!;
    const referral = sql.find((s) => s.includes("FROM payouts"))!;
    expect(advertiser).toContain("status = 'PAID'");
    expect(affiliate).toContain("status = 'PAID'");
    expect(referral).toContain("kind = 'REFERRAL'");
    expect(referral).toContain("status = 'COMPLETED'");
    // Payouts created by paying an affiliate invoice are PUBLISHER kind and must not count twice.
    expect(sql.some((s) => s.includes("kind = 'PUBLISHER'"))).toBe(false);
  });

  it("marks months with no profit as nothing due", () => {
    expect(partnerInvoiceStatusFor(10)).toBe("UNPAID");
    expect(partnerInvoiceStatusFor(0)).toBe("NOTHING_DUE");
  });
});

describe("partner invoice months", () => {
  it("picks the month that just ended on the 1st", () => {
    expect(previousUtcMonth(new Date("2026-10-01T00:15:00Z"))).toBe("2026-09");
    expect(previousUtcMonth(new Date("2026-01-01T00:15:00Z"))).toBe("2025-12");
  });

  it("covers the full UTC month", () => {
    const { start, end } = utcMonthRange("2026-02");
    expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });

  it("lists months across a year boundary", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("generatePartnerInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an unpaid invoice for 20% of the month's platform profit", async () => {
    mockTotals({ received: 1000, affiliate: 400, referral: 100 });
    prismaMock.partnerProfitInvoice.findUnique.mockResolvedValue(null);
    prismaMock.partnerProfitInvoice.create.mockImplementation(({ data }) =>
      Promise.resolve(invoiceRow(data)),
    );

    const result = await generatePartnerInvoice("2026-09", new Date("2026-10-01T00:15:00Z"));

    expect(result.created).toBe(true);
    const data = prismaMock.partnerProfitInvoice.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      number: "PP-2026-09",
      periodMonth: "2026-09",
      platformProfit: 500,
      amount: 100,
      status: "UNPAID",
    });
  });

  it("creates a nothing-due invoice for a loss month", async () => {
    mockTotals({ received: 100, affiliate: 400, referral: 0 });
    prismaMock.partnerProfitInvoice.findUnique.mockResolvedValue(null);
    prismaMock.partnerProfitInvoice.create.mockImplementation(({ data }) =>
      Promise.resolve(invoiceRow(data)),
    );

    await generatePartnerInvoice("2026-09", new Date("2026-10-01T00:15:00Z"));

    const data = prismaMock.partnerProfitInvoice.create.mock.calls[0]![0].data;
    expect(data.amount).toBe(0);
    expect(data.status).toBe("NOTHING_DUE");
  });

  it("does nothing when the month is already invoiced", async () => {
    prismaMock.partnerProfitInvoice.findUnique.mockResolvedValue(invoiceRow());

    const result = await generatePartnerInvoice("2026-09", new Date("2026-10-02T00:00:00Z"));

    expect(result.created).toBe(false);
    expect(prismaMock.partnerProfitInvoice.create).not.toHaveBeenCalled();
  });

  it("refuses the current month", async () => {
    await expect(
      generatePartnerInvoice("2026-10", new Date("2026-10-15T00:00:00Z")),
    ).rejects.toThrow("Only finished months");
  });

  it("monthly run backfills from the first month with money movement", async () => {
    mockTotals({ received: 0, affiliate: 0, referral: 0 });
    prismaMock.$queryRaw.mockImplementationOnce(() =>
      Promise.resolve([{ first: new Date("2026-07-20T10:00:00Z") }]),
    );
    prismaMock.partnerProfitInvoice.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.periodMonth === "2026-08" ? invoiceRow({ periodMonth: "2026-08" }) : null),
    );
    prismaMock.partnerProfitInvoice.create.mockImplementation(({ data }) =>
      Promise.resolve(invoiceRow(data)),
    );

    const result = await generateDuePartnerInvoices(new Date("2026-10-01T00:15:00Z"));

    expect(result).toEqual({ created: ["2026-07", "2026-09"], existing: ["2026-08"] });
  });
});

describe("markPartnerInvoicePaid", () => {
  const input = { paidAt: new Date("2026-10-05T00:00:00Z"), method: "Wise", reference: "T-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findFirst.mockResolvedValue({ id: "admin_1" });
  });

  it("marks an unpaid invoice paid and writes the audit log", async () => {
    prismaMock.partnerProfitInvoice.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.partnerProfitInvoice.findUniqueOrThrow.mockResolvedValue(
      invoiceRow({ status: "PAID", paidAt: input.paidAt, paymentMethod: "Wise", paidBy: { name: "Admin" } }),
    );

    const invoice = await markPartnerInvoicePaid("inv_1", input, "admin_1");

    expect(invoice.status).toBe("PAID");
    expect(invoice.paidByName).toBe("Admin");
    expect(prismaMock.partnerProfitInvoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv_1", status: "UNPAID" } }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "partner_invoice.paid", entityId: "inv_1" }),
      }),
    );
  });

  it("rejects an invoice that is already paid", async () => {
    prismaMock.partnerProfitInvoice.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.partnerProfitInvoice.findUnique.mockResolvedValue({ status: "PAID" });

    await expect(markPartnerInvoicePaid("inv_1", input, "admin_1")).rejects.toThrow(
      "Invoice is already paid",
    );
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects non-admins", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(markPartnerInvoicePaid("inv_1", input, "manager_1")).rejects.toThrow(
      "You do not have permission",
    );
  });
});

describe("summarizePartnerInvoices", () => {
  it("totals unpaid and paid invoices and ignores nothing-due ones", () => {
    const base = { amount: 0, status: "UNPAID" } as PartnerInvoiceRecord;
    const summary = summarizePartnerInvoices([
      { ...base, amount: 100, status: "UNPAID" },
      { ...base, amount: 50, status: "PAID" },
      { ...base, amount: 25, status: "PAID" },
      { ...base, amount: 0, status: "NOTHING_DUE" },
    ]);
    expect(summary).toEqual({ unpaid: 100, unpaidCount: 1, paid: 75, paidCount: 2 });
  });
});
