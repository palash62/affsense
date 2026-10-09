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

const soloConfig = vi.hoisted(() => ({ regularProviderCostCents: 20, warmProviderCostCents: 35 }));
vi.mock("@cpl/tracking-core", () => ({ loadSoloAdsConfig: () => Promise.resolve(soloConfig) }));

const digitalMock = vi.hoisted(() => ({ getDigitalSaleAmountsByBucket: vi.fn() }));
vi.mock("@/services/digital-product.service", () => digitalMock);

import {
  buildProfitTotals,
  generateDuePartnerInvoices,
  generatePartnerInvoice,
  getInvoiceProfitForRange,
  getInvoiceProfitPageData,
  markPartnerInvoicePaid,
  monthsBetween,
  partnerInvoiceStatusFor,
  previousUtcMonth,
  summarizePartnerInvoices,
  utcMonthRange,
} from "@/services/partner-invoice.service";
import type { PartnerInvoiceRecord } from "@/lib/partner-invoice";

type SqlLike = { strings?: string[]; values?: unknown[] };

function sqlText(callArgs: unknown[]): string {
  const first = callArgs[0];
  if (Array.isArray(first)) return first.join("?");
  if (first && typeof first === "object" && "strings" in first) {
    return (first as { strings: string[] }).strings.join("?");
  }
  return String(first ?? "");
}

/** Every bound value of a raw query, with Prisma.join lists flattened. */
function sqlValues(callArgs: unknown[]): unknown[] {
  return callArgs.slice(1).flatMap((value) => {
    const sql = value as SqlLike;
    return sql && typeof sql === "object" && Array.isArray(sql.values) ? sql.values : [value];
  });
}

type MockLines = {
  cpa?: number;
  offerwall?: number;
  soloChargesCents?: number;
  soloProviderCents?: number;
  otherCommissions?: number;
  referral?: number;
  digital?: Record<string, { sales: number; refunds: number; commissions: number; refundedCommissions: number }>;
};

/** Routes each raw query to a total by the table it reads; everything lands in `bucket`. */
function mockLines(lines: MockLines, bucket = "2026") {
  digitalMock.getDigitalSaleAmountsByBucket.mockResolvedValue(new Map(Object.entries(lines.digital ?? {})));
  prismaMock.$queryRaw.mockImplementation((...args: unknown[]) => {
    const sql = sqlText(args);
    if (sql.includes("MIN(")) return Promise.resolve([{ first: null }]);
    if (sql.includes("advertiser_cpa_invoices")) return Promise.resolve([{ bucket, total: lines.cpa ?? 0 }]);
    if (sql.includes("offerwall_conversions")) return Promise.resolve([{ bucket, total: lines.offerwall ?? 0 }]);
    if (sql.includes("solo_wallet_ledger")) {
      return Promise.resolve([
        { bucket, charges: lines.soloChargesCents ?? 0, providerCents: lines.soloProviderCents ?? 0 },
      ]);
    }
    if (sql.includes("ledger_entries")) {
      const referral = sqlValues(args).includes("referral");
      return Promise.resolve([{ bucket, total: (referral ? lines.referral : lines.otherCommissions) ?? 0 }]);
    }
    return Promise.resolve([]);
  });
}

const FULL_MONTH: MockLines = {
  cpa: 300,
  offerwall: 50,
  soloChargesCents: 9000,
  soloProviderCents: 4000,
  otherCommissions: 35,
  referral: 15,
  digital: { "2026": { sales: 500, refunds: 20, commissions: 200, refundedCommissions: 10 } },
};

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_1",
    number: "PP-2026-09",
    periodMonth: "2026-09",
    received: 1000,
    affiliateSent: 400,
    referralSent: 100,
    soloProviderCost: 0,
    breakdown: null,
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

  it("subtracts commissions and provider cost from income and splits 80/20", () => {
    expect(
      buildProfitTotals({
        digitalSales: 500,
        digitalRefunds: 20,
        offerwall: 50,
        soloAds: 90,
        cpaInvoices: 300,
        digitalCommissions: 190,
        otherCommissions: 35,
        referralCommissions: 15,
        soloProviderCost: 40,
      }),
    ).toMatchObject({
      income: 920,
      affiliateCommissions: 225,
      costs: 280,
      platformProfit: 640,
      adminProfit: 512,
      partnerProfit: 128,
    });
  });

  it("includes every income and cost line", async () => {
    mockLines(FULL_MONTH);

    const totals = await getInvoiceProfitForRange(new Date("2026-09-01"), new Date("2026-09-30"));

    expect(totals).toMatchObject({
      digitalSales: 500,
      digitalRefunds: 20,
      offerwall: 50,
      soloAds: 90,
      cpaInvoices: 300,
      digitalCommissions: 190,
      otherCommissions: 35,
      referralCommissions: 15,
      soloProviderCost: 40,
      platformProfit: 640,
      partnerProfit: 128,
    });
    const sql = prismaMock.$queryRaw.mock.calls.map((call) => sqlText(call));
    expect(sql.find((s) => s.includes("advertiser_cpa_invoices"))).toContain("status = 'PAID'");
    expect(sql.find((s) => s.includes("offerwall_conversions"))).toContain("COALESCE(network_payout, payout)");
  });

  it("does not count affiliate invoice payments, payouts or deposits", async () => {
    mockLines(FULL_MONTH);

    await getInvoiceProfitForRange(new Date("2026-09-01"), new Date("2026-09-30"));

    const calls = prismaMock.$queryRaw.mock.calls;
    const sql = calls.map((call) => sqlText(call));
    expect(sql.some((s) => s.includes("affiliate_invoices") || s.includes("FROM payouts"))).toBe(false);
    const referenceTypes = calls
      .filter((call) => sqlText(call).includes("ledger_entries"))
      .flatMap((call) => sqlValues(call))
      .filter((value): value is string => typeof value === "string");
    for (const excluded of ["payout", "referral_payout", "deposit", "adjustment", "solo_ads_transfer"]) {
      expect(referenceTypes).not.toContain(excluded);
    }
    expect(referenceTypes).toEqual(expect.arrayContaining(["lead", "offerwall_conversion", "referral_cpa"]));
    expect(sql.find((s) => s.includes("solo_wallet_ledger"))).toContain("l.type IN ('CHARGE', 'REFUND')");
  });

  it("prices provider cost from the campaign snapshot, falling back to the current setting", async () => {
    mockLines(FULL_MONTH);

    await getInvoiceProfitForRange(new Date("2026-09-01"), new Date("2026-09-30"));

    const call = prismaMock.$queryRaw.mock.calls.find((c) => sqlText(c).includes("solo_wallet_ledger"))!;
    expect(sqlText(call)).toContain("COALESCE(c.provider_cost_cents_snapshot");
    expect(sqlValues(call)).toEqual(expect.arrayContaining([35, 20]));
  });

  it("lowers the month a refund arrived in, not the month of the sale", async () => {
    mockLines(
      {
        digital: {
          "2026-09": { sales: 100, refunds: 0, commissions: 40, refundedCommissions: 0 },
          "2026-10": { sales: 0, refunds: 100, commissions: 0, refundedCommissions: 40 },
        },
      },
      "2026-09",
    );

    const data = await getInvoiceProfitPageData(
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-10-31T23:59:59Z"),
      "month",
    );

    const byPeriod = Object.fromEntries(data.rows.map((row) => [row.period, row.platformProfit]));
    expect(byPeriod).toEqual({ "2026-09": 60, "2026-10": -60 });
    expect(data.summary.platformProfit).toBe(0);
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
    mockLines(FULL_MONTH);
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
      received: 920,
      affiliateSent: 225,
      referralSent: 15,
      soloProviderCost: 40,
      platformProfit: 640,
      amount: 128,
      status: "UNPAID",
    });
    expect(data.breakdown).toMatchObject({ digitalRefunds: 20, offerwall: 50 });
    expect(result.invoice.breakdown).toMatchObject({ income: 920 });
  });

  it("creates a nothing-due invoice for a loss month", async () => {
    mockLines({ cpa: 100, otherCommissions: 400 });
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
    mockLines({});
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
